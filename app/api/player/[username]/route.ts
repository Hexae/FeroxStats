import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { serviceClient } from '@/lib/supabase-service';

const FEROX_API = 'https://ferox.ps/api';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const decoded = decodeURIComponent(username);

  // Fetch live data from Ferox API
  let hiscoreData;
  try {
    const res = await fetch(`${FEROX_API}/hiscores?player=${encodeURIComponent(decoded)}`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'Player not found on Ferox.ps' }, { status: 404 });
    }
    hiscoreData = await res.json();
  } catch {
    return NextResponse.json({ error: 'Failed to fetch player data' }, { status: 502 });
  }

  // Write to Supabase only if the player record is new or stale (> 15 min old).
  // The scheduled cron job at /api/cron/update-players handles periodic refreshes for
  // all known players, so we avoid flooding the DB on every page load.
  try {
    const db = serviceClient();

    const overallSkill = hiscoreData.skills?.find((s: { id: number }) => s.id === 0);
    const totalLevel = overallSkill?.level ?? 0;
    const totalXp = parseInt(overallSkill?.xp ?? '0', 10);
    const overallRank = overallSkill?.rank ?? -1;
    const rawName: string = hiscoreData.name ?? decoded;
    const displayName = rawName.replace(/\b\w/g, c => c.toUpperCase());
    const usernameKey = decoded.toLowerCase();

    // Check when this player was last written to the DB
    const { data: existing } = await db
      .from('players')
      .select('last_fetched_at')
      .eq('username', usernameKey)
      .single() as { data: { last_fetched_at: string | null } | null };

    const FIFTEEN_MINUTES = 15 * 60 * 1000;
    const lastFetched = existing?.last_fetched_at ? new Date(existing.last_fetched_at).getTime() : 0;
    const isStale = Date.now() - lastFetched > FIFTEEN_MINUTES;

    if (isStale) {
      const { error: upsertErr } = await db.from('players').upsert(
        {
          username: usernameKey,
          display_name: displayName,
          total_level: totalLevel,
          total_xp: totalXp,
          overall_rank: overallRank,
          last_fetched_at: new Date().toISOString(),
        },
        { onConflict: 'username' }
      );
      if (upsertErr) { /* non-fatal: player data still returned from hiscores */ }

      const { error: snapErr } = await db.from('player_snapshots').insert({
        player_username: usernameKey,
        snapshot_data: hiscoreData,
        total_level: totalLevel,
        total_xp: totalXp,
        overall_rank: overallRank,
      });
      if (snapErr) { /* non-fatal: snapshot failure does not affect the response */ }
    }
  } catch { /* non-fatal: DB write failure does not affect hiscores response */ }

  // Fetch game mode and claim status from DB
  let game_mode = 'regular';
  let is_claimed = false;
  let last_fetched_at: string | null = null;
  let country: string | null = null;
  let cover_screenshot_id: string | null = null;
  let screenshots: Array<{ id: string; public_url: string; created_at: string }> = [];
  try {
    const supabase2 = await createClient();
    const { data: playerRow } = await supabase2
      .from('players')
      .select('game_mode, claimed_by, last_fetched_at, country, cover_screenshot_id')
      .eq('username', decoded.toLowerCase())
      .single();
    if (playerRow) {
      game_mode = playerRow.game_mode ?? 'regular';
      is_claimed = !!playerRow.claimed_by;
      last_fetched_at = playerRow.last_fetched_at ?? null;
      country = (playerRow as { country?: string | null }).country ?? null;
      cover_screenshot_id = (playerRow as { cover_screenshot_id?: string | null }).cover_screenshot_id ?? null;
    }
    const { data: screenshotRows } = await supabase2
      .from('player_screenshots')
      .select('id, public_url, created_at, sort_order')
      .eq('player_username', decoded.toLowerCase())
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    screenshots = screenshotRows ?? [];
  } catch { /* ignore */ }

  return NextResponse.json({
    ...hiscoreData,
    game_mode,
    is_claimed,
    last_fetched_at,
    country,
    cover_screenshot_id,
    screenshots,
  });
}
