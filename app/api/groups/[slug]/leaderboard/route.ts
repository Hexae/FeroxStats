import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase-service';
import { SKILL_NAMES } from '@/lib/api-utils';

type Params = { params: Promise<{ slug: string }> };

// GET /api/groups/[slug]/leaderboard?period=week|month|year|all&skill=overall
export async function GET(request: NextRequest, { params }: Params) {
  const { slug } = await params;
  const url = new URL(request.url);
  const period = url.searchParams.get('period') ?? 'week';
  const skill = url.searchParams.get('skill') ?? 'overall';

  const skillId = (SKILL_NAMES as readonly string[]).indexOf(skill);
  if (skillId === -1) {
    return NextResponse.json({ error: 'Invalid skill' }, { status: 400 });
  }
  const isOverall = skillId === 0;

  const supabase = serviceClient();

  const { data: group } = await supabase.from('groups').select('id, name').eq('slug', slug).single();
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

  const { data: members } = await supabase
    .from('group_members')
    .select('username, role, joined_at')
    .eq('group_id', group.id);

  if (!members || members.length === 0) return NextResponse.json([]);

  const usernames = members.map(m => m.username);

  // Determine the start time
  const now = new Date();
  let since: Date | null = null;
  if (period === 'week') {
    since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (period === 'month') {
    since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else if (period === 'year') {
    since = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  }

  // Fetch current player stats
  const { data: players } = await supabase
    .from('players')
    .select('username, display_name, total_xp, total_level, overall_rank')
    .in('username', usernames);

  const playerMap: Record<string, { display_name: string; total_xp: number; total_level: number; overall_rank: number | null }> = {};
  for (const p of players ?? []) {
    playerMap[p.username] = {
      display_name: p.display_name,
      total_xp: p.total_xp ?? 0,
      total_level: p.total_level ?? 0,
      overall_rank: p.overall_rank ?? null,
    };
  }

  // Fetch snapshots for XP gains
  const xpGainMap: Record<string, number> = {};
  if (since) {
    const query = supabase
      .from('player_snapshots')
      .select('player_username, total_xp, snapshot_data, created_at')
      .in('player_username', usernames)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: true });

    const { data: snapshots } = await query;

    const firstSnap: Record<string, number> = {};
    const minSnap: Record<string, number> = {};
    const lastSnap: Record<string, number> = {};
    for (const s of snapshots ?? []) {
      const u = s.player_username;
      let xp = 0;
      if (isOverall) {
        xp = s.total_xp ?? 0;
      } else {
        try {
          const data = typeof s.snapshot_data === 'string' ? JSON.parse(s.snapshot_data) : s.snapshot_data;
          const sk = data?.skills?.find((entry: { id: number; xp: number }) => entry.id === skillId);
          xp = sk?.xp ?? 0;
        } catch {
          xp = 0;
        }
      }
      if (!(u in firstSnap)) firstSnap[u] = xp;
      if (!(u in minSnap) || xp < minSnap[u]) minSnap[u] = xp;
      lastSnap[u] = xp;
    }
    for (const u of usernames) {
      if (u in firstSnap && u in lastSnap) {
        let gained = lastSnap[u] - firstSnap[u];
        if (gained <= 0 && u in minSnap && lastSnap[u] > minSnap[u]) {
          gained = lastSnap[u] - minSnap[u];
        }
        xpGainMap[u] = Math.max(0, gained);
      } else {
        xpGainMap[u] = 0;
      }
    }
  }

  const memberRole: Record<string, string> = {};
  for (const m of members) {
    memberRole[m.username] = m.role;
  }

  const leaderboard = usernames.map(u => ({
    username: u,
    display_name: playerMap[u]?.display_name ?? u,
    total_xp: playerMap[u]?.total_xp ?? 0,
    total_level: playerMap[u]?.total_level ?? 0,
    overall_rank: playerMap[u]?.overall_rank ?? null,
    xp_gained: since ? (xpGainMap[u] ?? 0) : (playerMap[u]?.total_xp ?? 0),
    role: memberRole[u] ?? 'member',
  }));

  leaderboard.sort((a, b) => b.xp_gained - a.xp_gained);

  return NextResponse.json(leaderboard);
}
