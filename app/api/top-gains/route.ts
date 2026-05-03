import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase-service';
import { rateLimit } from '@/lib/api-utils';
import { subDays, subMonths } from 'date-fns';

type Period = 'day' | 'week' | 'month';

function getPeriodStart(period: Period): Date {
  const now = new Date();
  switch (period) {
    case 'day':   return subDays(now, 1);
    case 'week':  return subDays(now, 7);
    case 'month': return subMonths(now, 1);
  }
}

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
  const limited = rateLimit(`top-gains:${ip}`, { limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  const raw = request.nextUrl.searchParams.get('period') ?? 'week';
  const period = (['day', 'week', 'month'].includes(raw) ? raw : 'week') as Period;
  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') ?? 20), 50);

  const db = serviceClient();
  const since = getPeriodStart(period);

  // Get all players
  const { data: players } = await db
    .from('players')
    .select('username, display_name, game_mode');

  if (!players || players.length === 0) {
    return NextResponse.json({ period, gains: [] });
  }

  // Single batch query: fetch ALL snapshots in the period, ordered by time
  const { data: allSnaps } = await db
    .from('player_snapshots')
    .select('player_username, total_xp, snapshot_data, created_at')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: true });

  if (!allSnaps || allSnaps.length === 0) {
    return NextResponse.json({ period, gains: [] });
  }

  // Group snapshots: track first and last per player
  type SkillRow = { id: number; level: number };
  const first = new Map<string, { total_xp: number; skills: SkillRow[] }>();
  const last = new Map<string, { total_xp: number; skills: SkillRow[] }>();

  for (const snap of allSnaps) {
    const u = snap.player_username;
    const entry = {
      total_xp: snap.total_xp ?? 0,
      skills: ((snap.snapshot_data as { skills?: SkillRow[] } | null)?.skills ?? []) as SkillRow[],
    };
    if (!first.has(u)) first.set(u, entry);
    last.set(u, entry); // always overwrite — ordered ascending so last write is newest
  }

  // Build display name map
  const nameMap = new Map(players.map(p => [p.username, p.display_name]));
  const gameModeMap = new Map(players.map(p => [p.username, p.game_mode ?? 'regular']));

  const gains: Array<{
    username: string;
    display_name: string;
    game_mode: string;
    xpGained: number;
    levelsGained: number;
  }> = [];

  for (const [username, oldest] of first) {
    const newest = last.get(username)!;
    const xpGained = newest.total_xp - oldest.total_xp;
    if (xpGained <= 0) continue;

    const oldTotal = oldest.skills.find(s => s.id === 0)?.level ?? 0;
    const newTotal = newest.skills.find(s => s.id === 0)?.level ?? 0;

    gains.push({
      username,
      display_name: nameMap.get(username) ?? username,
      game_mode: gameModeMap.get(username) ?? 'regular',
      xpGained,
      levelsGained: newTotal - oldTotal,
    });
  }

  gains.sort((a, b) => b.xpGained - a.xpGained);

  return NextResponse.json(
    { period, gains: gains.slice(0, limit) },
    { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60' } },
  );
}
