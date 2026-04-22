import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase-service';
import { timingSafeEqual } from 'crypto';

const FEROX_API = 'https://ferox.ps/api';
const REQUEST_DELAY_MS = 500;
// Skip players updated within the last 30 minutes
const STALE_THRESHOLD_MS = 30 * 60 * 1000;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || !authHeader || !safeCompare(authHeader, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = serviceClient();

  const { data: players, error: listErr } = await db
    .from('players')
    .select('username, display_name, last_fetched_at');

  if (listErr) {
    console.error('[cron] Failed to fetch players:', listErr);
    return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 });
  }

  if (!players || players.length === 0) {
    return NextResponse.json({ updated: 0, skipped: 0, failed: 0 });
  }

  let updated = 0;
  let failed = 0;
  let skipped = 0;
  const now = Date.now();

  for (const player of players) {
    // Skip recently updated players
    if (player.last_fetched_at) {
      const lastFetched = new Date(player.last_fetched_at).getTime();
      if (now - lastFetched < STALE_THRESHOLD_MS) {
        skipped++;
        continue;
      }
    }

    try {
      const res = await fetch(
        `${FEROX_API}/hiscores?player=${encodeURIComponent(player.username)}`,
        { cache: 'no-store', signal: AbortSignal.timeout(8000) },
      );

      if (!res.ok) {
        console.warn(`[cron] Ferox API returned ${res.status} for ${player.username}`);
        failed++;
        await sleep(REQUEST_DELAY_MS);
        continue;
      }

      const hiscoreData = await res.json();
      const overallSkill = hiscoreData.skills?.find((s: { id: number }) => s.id === 0);
      const totalLevel = overallSkill?.level ?? 0;
      const totalXp = parseInt(overallSkill?.xp ?? '0', 10);
      const overallRank = overallSkill?.rank ?? -1;
      const rawName: string = hiscoreData.name ?? player.username;
      const displayName = rawName.replace(/\b\w/g, (c: string) => c.toUpperCase());

      const { error: upsertErr } = await db.from('players').upsert(
        {
          username: player.username,
          display_name: displayName,
          total_level: totalLevel,
          total_xp: totalXp,
          overall_rank: overallRank,
          last_fetched_at: new Date().toISOString(),
        },
        { onConflict: 'username' }
      );
      if (upsertErr) {
        console.error(`[cron] Upsert failed for ${player.username}:`, upsertErr);
        failed++;
        await sleep(REQUEST_DELAY_MS);
        continue;
      }

      const { error: snapErr } = await db.from('player_snapshots').insert({
        player_username: player.username,
        snapshot_data: hiscoreData,
        total_level: totalLevel,
        total_xp: totalXp,
        overall_rank: overallRank,
      });
      if (snapErr) console.error(`[cron] Snapshot failed for ${player.username}:`, snapErr);

      updated++;
    } catch (e) {
      console.error(`[cron] Error processing ${player.username}:`, e);
      failed++;
    }

    await sleep(REQUEST_DELAY_MS);
  }

  console.log(`[cron] Done — updated: ${updated}, skipped: ${skipped}, failed: ${failed}`);
  return NextResponse.json({ updated, skipped, failed, total: players.length });
}
