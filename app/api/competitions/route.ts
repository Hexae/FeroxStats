import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase-service';

export const revalidate = 60; // cache 60 s

// GET /api/competitions
// Returns all active + upcoming competitions (within 7 days) across all groups,
// enriched with group name/slug and participant count.
export async function GET() {
  const supabase = serviceClient();
  const now = new Date();
  const upcoming = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 days

  // Fetch comps that haven't ended yet, or start within 7 days
  const { data: comps, error } = await supabase
    .from('group_competitions')
    .select('id, group_id, name, metric, starts_at, ends_at')
    .or(`ends_at.gte.${now.toISOString()},starts_at.lte.${upcoming.toISOString()}`)
    .order('starts_at', { ascending: true })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!comps || comps.length === 0) return NextResponse.json([]);

  const groupIds = [...new Set(comps.map((c) => c.group_id))];

  // Fetch group details
  const { data: groups } = await supabase
    .from('groups')
    .select('id, name, slug')
    .in('id', groupIds);

  const groupMap: Record<string, { name: string; slug: string }> = {};
  for (const g of groups ?? []) groupMap[g.id] = { name: g.name, slug: g.slug };

  // Fetch participant counts per competition (via group_members for each group)
  const { data: memberRows } = await supabase
    .from('group_members')
    .select('group_id')
    .in('group_id', groupIds);

  const memberCountMap: Record<string, number> = {};
  for (const row of memberRows ?? []) {
    memberCountMap[row.group_id] = (memberCountMap[row.group_id] ?? 0) + 1;
  }

  const nowStr = now.toISOString();

  const result = comps.map((c) => {
    const isActive = c.starts_at <= nowStr && c.ends_at >= nowStr;
    const isUpcoming = c.starts_at > nowStr;
    const totalMs = new Date(c.ends_at).getTime() - new Date(c.starts_at).getTime();
    const elapsedMs = isActive
      ? now.getTime() - new Date(c.starts_at).getTime()
      : 0;
    const progressPct = isActive && totalMs > 0
      ? Math.min(100, Math.round((elapsedMs / totalMs) * 100))
      : isUpcoming ? 0 : 100;

    return {
      id: c.id,
      name: c.name,
      metric: c.metric,
      starts_at: c.starts_at,
      ends_at: c.ends_at,
      group_id: c.group_id,
      group_name: groupMap[c.group_id]?.name ?? 'Unknown',
      group_slug: groupMap[c.group_id]?.slug ?? '',
      participant_count: memberCountMap[c.group_id] ?? 0,
      status: isActive ? 'active' : isUpcoming ? 'upcoming' : 'ended',
      progress_pct: progressPct,
    };
  }).filter((c) => c.status !== 'ended'); // exclude ended

  return NextResponse.json(result);
}
