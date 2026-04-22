import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase-service';
import { rateLimit } from '@/lib/api-utils';

const FEROX_API = 'https://ferox.ps/api';

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
  const limited = rateLimit(`compare:${ip}`, { limit: 15, windowMs: 60_000 });
  if (limited) return limited;

  const players = request.nextUrl.searchParams.get('players');
  if (!players) {
    return NextResponse.json({ error: 'Missing ?players=name1,name2' }, { status: 400 });
  }

  const names = players.split(',').map(n => n.trim()).filter(Boolean).slice(0, 5);
  if (names.length < 2) {
    return NextResponse.json({ error: 'Need at least 2 player names' }, { status: 400 });
  }

  const db = serviceClient();

  const results: Array<{ username: string; data: unknown; error?: string }> = [];

  for (const name of names) {
    try {
      const res = await fetch(
        `${FEROX_API}/hiscores?player=${encodeURIComponent(name)}`,
        { cache: 'no-store', signal: AbortSignal.timeout(8000) },
      );

      if (!res.ok) {
        results.push({ username: name, data: null, error: 'Not found on Ferox.ps' });
        continue;
      }

      const hiscoreData = await res.json();
      results.push({ username: name, data: hiscoreData });

      // Ensure the player exists in the DB so future queries work
      const usernameKey = name.toLowerCase();
      const overallSkill = hiscoreData.skills?.find((s: { id: number }) => s.id === 0);
      const totalLevel = overallSkill?.level ?? 0;
      const totalXp = parseInt(overallSkill?.xp ?? '0');
      const overallRank = overallSkill?.rank ?? -1;
      const rawName: string = hiscoreData.name ?? name;
      const displayName = rawName.replace(/\b\w/g, (c: string) => c.toUpperCase());

      // Best-effort upsert — don't fail the compare if DB write fails
      await db.from('players').upsert(
        {
          username: usernameKey,
          display_name: displayName,
          total_level: totalLevel,
          total_xp: totalXp,
          overall_rank: overallRank,
          last_fetched_at: new Date().toISOString(),
        },
        { onConflict: 'username' }
      ).then(() => {});

      await db.from('player_snapshots').insert({
        player_username: usernameKey,
        snapshot_data: hiscoreData,
        total_level: totalLevel,
        total_xp: totalXp,
        overall_rank: overallRank,
      }).then(() => {});

    } catch {
      results.push({ username: name, data: null, error: 'Failed to fetch' });
    }
  }

  return NextResponse.json({ players: results });
}
