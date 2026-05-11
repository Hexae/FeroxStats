import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase-service';
import { SKILL_NAMES } from '@/lib/api-utils';

type Params = { params: Promise<{ id: string }> };

// Extract XP for a given skill from a snapshot row.
function extractXp(
  s: { total_xp?: number; snapshot_data?: unknown },
  skillId: number,
  metric: string,
): number {
  if (skillId === 0 || metric === 'overall') return s.total_xp ?? 0;
  try {
    const data = typeof s.snapshot_data === 'string'
      ? JSON.parse(s.snapshot_data as string)
      : s.snapshot_data as { skills?: { id: number; xp: number }[] };
    return data?.skills?.find((sk: { id: number; xp: number }) => sk.id === skillId)?.xp ?? 0;
  } catch { return 0; }
}

// Build chart_data for the top 5 standings entries by querying player_snapshots.
async function buildChartData(
  supabase: ReturnType<typeof serviceClient>,
  top5: { username: string; display_name: string; start_xp: number }[],
  startsAt: string,
  endsAt: string,
  skillId: number,
  metric: string,
) {
  if (top5.length === 0) return [];

  const { data: chartSnapshots } = await supabase
    .from('player_snapshots')
    .select('player_username, total_xp, snapshot_data, created_at')
    .in('player_username', top5.map((s) => s.username))
    .gte('created_at', startsAt)
    .lte('created_at', endsAt)
    .order('created_at', { ascending: true });

  const firstXp: Record<string, number> = {};
  const timeSeries: Record<string, Array<{ t: string; xp: number }>> = {};

  for (const snap of chartSnapshots ?? []) {
    const u = snap.player_username;
    const xp = extractXp(snap, skillId, metric);
    if (!(u in firstXp)) { firstXp[u] = xp; timeSeries[u] = []; }
    timeSeries[u].push({ t: snap.created_at ?? '', xp });
  }

  return top5.map((s) => ({
    username: s.username,
    display_name: s.display_name,
    points: (timeSeries[s.username] ?? []).map((p) => ({
      t: p.t,
      xp_gained: Math.max(0, p.xp - (firstXp[s.username] ?? s.start_xp)),
    })),
  }));
}

// GET /api/competitions/[id]
// Returns competition detail + full standings by comp ID (without needing group slug).
// Reads from the pre-computed competition_standings cache when available;
// falls back to a live scan of player_snapshots when the cache is empty.
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

  // Fetch group info, members, and display names in parallel
  const [
    { data: group },
    { data: members },
  ] = await Promise.all([
    supabase.from('groups').select('id, name, slug, description').eq('id', comp.group_id).single(),
    supabase.from('group_members').select('username, role').eq('group_id', comp.group_id),
  ]);

  const usernames = (members ?? []).map((m: { username: string }) => m.username);

  const { data: players } = await supabase
    .from('players')
    .select('username, display_name')
    .in('username', usernames.length > 0 ? usernames : ['__none__']);

  const nameMap: Record<string, string> = {};
  for (const p of players ?? []) nameMap[p.username] = p.display_name;

  // Map metric name to skill ID
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

  const base = {
    ...comp,
    group_name: group?.name ?? 'Unknown',
    group_slug: group?.slug ?? '',
    group_description: group?.description ?? null,
    participant_count: usernames.length,
    status,
    progress_pct: progressPct,
  };

  if (usernames.length === 0) {
    return NextResponse.json({ ...base, standings: [], chart_data: [], total_gained: 0 });
  }

  // ── Try the pre-computed standings cache first ─────────────────────────────
  const { data: cached } = await supabase
    .from('competition_standings')
    .select('username, rank, xp_gained, start_xp, end_xp, updated_at')
    .eq('competition_id', id)
    .order('rank', { ascending: true });

  if (cached && cached.length > 0) {
    const standings = cached.map((r: {
      username: string; rank: number; xp_gained: number;
      start_xp: number; end_xp: number; updated_at: string;
    }) => ({
      username: r.username,
      display_name: nameMap[r.username] ?? r.username,
      xp_gained: r.xp_gained,
      start_xp: r.start_xp,
      end_xp: r.end_xp,
      last_updated_at: r.updated_at,
    }));

    const total_gained = standings.reduce((sum, s) => sum + s.xp_gained, 0);
    const chart_data = await buildChartData(
      supabase,
      standings.slice(0, 5).map((s) => ({ username: s.username, display_name: s.display_name, start_xp: s.start_xp })),
      comp.starts_at,
      comp.ends_at,
      skillId,
      metric,
    );

    return NextResponse.json({ ...base, total_gained, standings, chart_data });
  }

  // ── Cache miss: compute live from player_snapshots ─────────────────────────
  const { data: snapshots } = await supabase
    .from('player_snapshots')
    .select('player_username, total_xp, snapshot_data, created_at')
    .in('player_username', usernames)
    .gte('created_at', comp.starts_at)
    .lte('created_at', comp.ends_at)
    .order('created_at', { ascending: true });

  const firstSnap: Record<string, number> = {};
  const minSnap: Record<string, number> = {};
  const lastSnap: Record<string, number> = {};
  const lastUpdatedAt: Record<string, string> = {};
  const timeSeries: Record<string, Array<{ t: string; xp: number }>> = {};

  for (const s of snapshots ?? []) {
    const u = s.player_username;
    const xp = extractXp(s, skillId, metric);
    if (!(u in firstSnap)) { firstSnap[u] = xp; timeSeries[u] = []; }
    if (!(u in minSnap) || xp < minSnap[u]) minSnap[u] = xp;
    lastSnap[u] = xp;
    lastUpdatedAt[u] = s.created_at ?? '';
    timeSeries[u].push({ t: s.created_at ?? '', xp });
  }

  const standings = usernames.map((u: string) => ({
    username: u,
    display_name: nameMap[u] ?? u,
    xp_gained: (() => {
      const first = firstSnap[u] ?? 0;
      const last = lastSnap[u] ?? 0;
      let gained = last - first;
      if (gained <= 0) {
        const min = minSnap[u];
        if (typeof min === 'number' && last > min) gained = last - min;
      }
      return Math.max(0, gained);
    })(),
    start_xp: firstSnap[u] ?? 0,
    end_xp: lastSnap[u] ?? 0,
    last_updated_at: lastUpdatedAt[u] ?? null,
  }));
  standings.sort((a, b) => b.xp_gained - a.xp_gained);

  const total_gained = standings.reduce((sum, s) => sum + s.xp_gained, 0);

  const chart_data = standings.slice(0, 5).map((s) => ({
    username: s.username,
    display_name: s.display_name,
    points: (timeSeries[s.username] ?? []).map((p) => ({
      t: p.t,
      xp_gained: Math.max(0, p.xp - (firstSnap[s.username] ?? 0)),
    })),
  }));

  return NextResponse.json({ ...base, total_gained, standings, chart_data });
}
