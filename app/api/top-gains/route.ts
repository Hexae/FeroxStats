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
  const targetUsername = request.nextUrl.searchParams.get('username')?.trim().toLowerCase() ?? null;

  const db = serviceClient();
  const since = getPeriodStart(period);

  // Get all players
  const { data: players } = await db
    .from('players')
    .select('username, display_name, game_mode');

  if (!players || players.length === 0) {
    return NextResponse.json({ period, gains: [], rank: null });
  }

  // Fetch snapshots in pages to avoid missing rows due API caps.
  const pageSize = 1000;
  let from = 0;
  let sawSnapshot = false;

  // Group snapshots: track first/last per player, plus a minimum XP fallback.
  // If first->last is non-positive due to a bad early snapshot, we recover using min->last.
  type SkillRow = { id: number; level: number };
  const first = new Map<string, { total_xp: number; skills: SkillRow[] }>();
  const last = new Map<string, { total_xp: number; skills: SkillRow[] }>();
  const min = new Map<string, { total_xp: number; skills: SkillRow[] }>();

  while (true) {
    const { data: batch } = await db
      .from('player_snapshots')
      .select('player_username, total_xp, snapshot_data, created_at')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: true })
      .range(from, from + pageSize - 1);

    const rows = batch ?? [];
    if (rows.length === 0) break;
    sawSnapshot = true;

    for (const snap of rows) {
      const u = snap.player_username;
      const entry = {
        total_xp: snap.total_xp ?? 0,
        skills: ((snap.snapshot_data as { skills?: SkillRow[] } | null)?.skills ?? []) as SkillRow[],
      };
      if (!first.has(u)) first.set(u, entry);
      last.set(u, entry); // always overwrite — ordered ascending so last write is newest
      const existingMin = min.get(u);
      if (!existingMin || entry.total_xp < existingMin.total_xp) {
        min.set(u, entry);
      }
    }

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  if (!sawSnapshot) {
    return NextResponse.json({ period, gains: [], rank: null });
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
    let baseline = oldest;
    let xpGained = newest.total_xp - baseline.total_xp;

    if (xpGained <= 0) {
      const minimum = min.get(username);
      if (minimum && newest.total_xp > minimum.total_xp) {
        baseline = minimum;
        xpGained = newest.total_xp - baseline.total_xp;
      }
    }

    if (xpGained <= 0) continue;

    const oldTotal = baseline.skills.find(s => s.id === 0)?.level ?? 0;
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

  const rank = targetUsername
    ? (() => {
        const idx = gains.findIndex((g) => g.username.toLowerCase() === targetUsername);
        return idx >= 0 ? idx + 1 : null;
      })()
    : null;

  return NextResponse.json(
    { period, gains: gains.slice(0, limit), rank },
    { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60' } },
  );
}
