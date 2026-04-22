import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase-service';
import { SKILL_NAMES } from '@/lib/api-utils';

type Params = { params: Promise<{ id: string }> };

// GET /api/competitions/[id]
// Returns competition detail + full standings by comp ID (without needing group slug)
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = serviceClient();

  // Fetch the competition
  const { data: comp, error: compError } = await supabase
    .from('group_competitions')
    .select('*')
    .eq('id', id)
    .single();

  if (compError || !comp) {
    return NextResponse.json({ error: 'Competition not found' }, { status: 404 });
  }

  // Fetch group info
  const { data: group } = await supabase
    .from('groups')
    .select('id, name, slug, description')
    .eq('id', comp.group_id)
    .single();

  // Fetch group members
  const { data: members } = await supabase
    .from('group_members')
    .select('username, role')
    .eq('group_id', comp.group_id);

  const memberList = members ?? [];
  const usernames = memberList.map((m) => m.username);

  // Display names
  const { data: players } = await supabase
    .from('players')
    .select('username, display_name')
    .in('username', usernames.length > 0 ? usernames : ['__none__']);

  const nameMap: Record<string, string> = {};
  for (const p of players ?? []) nameMap[p.username] = p.display_name;

  // Map metric name to skill ID (index in SKILL_NAMES)
  const metric = comp.metric.toLowerCase();
  const skillId = (SKILL_NAMES as readonly string[]).indexOf(metric);

  // Compute status
  const now = new Date();
  const nowStr = now.toISOString();
  const isActive = comp.starts_at <= nowStr && comp.ends_at >= nowStr;
  const isUpcoming = comp.starts_at > nowStr;
  const status = isActive ? 'active' : isUpcoming ? 'upcoming' : 'ended';

  const totalMs = new Date(comp.ends_at).getTime() - new Date(comp.starts_at).getTime();
  const elapsedMs = isActive ? now.getTime() - new Date(comp.starts_at).getTime() : 0;
  const progressPct = isActive && totalMs > 0
    ? Math.min(100, Math.round((elapsedMs / totalMs) * 100))
    : isUpcoming ? 0 : 100;

  if (usernames.length === 0) {
    return NextResponse.json({
      ...comp,
      group_name: group?.name ?? 'Unknown',
      group_slug: group?.slug ?? '',
      group_description: group?.description ?? null,
      participant_count: 0,
      status,
      progress_pct: progressPct,
      standings: [],
    });
  }

  // Fetch snapshots within the competition window
  const { data: snapshots } = await supabase
    .from('player_snapshots')
    .select('player_username, total_xp, snapshot_data, created_at')
    .in('player_username', usernames)
    .gte('created_at', comp.starts_at)
    .lte('created_at', comp.ends_at)
    .order('created_at', { ascending: true });

  // Extract XP from a snapshot row
  function extractXp(s: { total_xp?: number; snapshot_data?: unknown }): number {
    if (skillId === 0 || metric === 'overall') return s.total_xp ?? 0;
    try {
      const data = typeof s.snapshot_data === 'string'
        ? JSON.parse(s.snapshot_data as string)
        : s.snapshot_data as { skills?: { id: number; xp: number }[] };
      return data?.skills?.find((sk: { id: number; xp: number }) => sk.id === skillId)?.xp ?? 0;
    } catch { return 0; }
  }

  // Per-player tracking
  const firstSnap: Record<string, number> = {};
  const lastSnap: Record<string, number> = {};
  const lastUpdatedAt: Record<string, string> = {};
  const timeSeries: Record<string, Array<{ t: string; xp: number }>> = {};

  for (const s of snapshots ?? []) {
    const u = s.player_username;
    const xp = extractXp(s);
    if (!(u in firstSnap)) { firstSnap[u] = xp; timeSeries[u] = []; }
    lastSnap[u] = xp;
    lastUpdatedAt[u] = s.created_at ?? '';
    timeSeries[u].push({ t: s.created_at ?? '', xp });
  }

  const standings = usernames.map((u) => ({
    username: u,
    display_name: nameMap[u] ?? u,
    xp_gained: Math.max(0, (lastSnap[u] ?? 0) - (firstSnap[u] ?? 0)),
    start_xp: firstSnap[u] ?? 0,
    end_xp: lastSnap[u] ?? 0,
    last_updated_at: lastUpdatedAt[u] ?? null,
  }));

  standings.sort((a, b) => b.xp_gained - a.xp_gained);

  const total_gained = standings.reduce((sum, s) => sum + s.xp_gained, 0);

  // Chart data for top 5
  const chart_data = standings.slice(0, 5).map((s) => ({
    username: s.username,
    display_name: s.display_name,
    points: (timeSeries[s.username] ?? []).map((p) => ({
      t: p.t,
      xp_gained: Math.max(0, p.xp - (firstSnap[s.username] ?? 0)),
    })),
  }));

  return NextResponse.json({
    ...comp,
    group_name: group?.name ?? 'Unknown',
    group_slug: group?.slug ?? '',
    group_description: group?.description ?? null,
    participant_count: usernames.length,
    status,
    progress_pct: progressPct,
    total_gained,
    standings,
    chart_data,
  });
}
