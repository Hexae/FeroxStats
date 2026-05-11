import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase-service';
import { SKILL_NAMES } from '@/lib/api-utils';

// GET /api/player/[username]/groups
// Returns the groups a player belongs to, with active competitions and their standing.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const decoded = decodeURIComponent(username).toLowerCase();
  const supabase = serviceClient();

  // 1. Find all group memberships for this player
  const { data: memberships, error: memErr } = await supabase
    .from('group_members')
    .select('group_id, role, joined_at')
    .eq('username', decoded);

  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 });
  if (!memberships || memberships.length === 0) {
    return NextResponse.json([]);
  }

  const groupIds = memberships.map((m) => m.group_id);

  // 2. Fetch group details
  const { data: groups, error: groupErr } = await supabase
    .from('groups')
    .select('id, name, slug, description, is_private, created_at')
    .in('id', groupIds);

  if (groupErr) return NextResponse.json({ error: groupErr.message }, { status: 500 });

  // 3. Fetch member counts for each group
  const { data: memberCounts } = await supabase
    .from('group_members')
    .select('group_id')
    .in('group_id', groupIds);

  const countMap: Record<string, number> = {};
  for (const row of memberCounts ?? []) {
    countMap[row.group_id] = (countMap[row.group_id] ?? 0) + 1;
  }

  // 4. Fetch active + upcoming competitions for these groups
  const now = new Date().toISOString();
  const { data: competitions } = await supabase
    .from('group_competitions')
    .select('id, group_id, name, metric, starts_at, ends_at')
    .in('group_id', groupIds)
    .gte('ends_at', now) // not ended yet
    .order('starts_at', { ascending: true });

  // 5. For active competitions (already started), get this player's standing
  const activeComps = (competitions ?? []).filter((c) => c.starts_at <= now);
  const compStandings: Record<string, { rank: number; xp_gained: number; total_participants: number }> = {};

  for (const comp of activeComps) {
    // Get group members for this competition
    const { data: groupMembers } = await supabase
      .from('group_members')
      .select('username')
      .eq('group_id', comp.group_id);

    const usernames = (groupMembers ?? []).map((m) => m.username);
    if (usernames.length === 0) continue;

    // Map metric to skill id (0 = overall)
    const skillId = (SKILL_NAMES as readonly string[]).indexOf(comp.metric.toLowerCase());

    // Fetch snapshots within competition window
    const { data: snapshots } = await supabase
      .from('player_snapshots')
      .select('player_username, total_xp, snapshot_data, created_at')
      .in('player_username', usernames)
      .gte('created_at', comp.starts_at)
      .lte('created_at', now)
      .order('created_at', { ascending: true });

    const firstSnap: Record<string, number> = {};
    const minSnap: Record<string, number> = {};
    const lastSnap: Record<string, number> = {};

    for (const s of snapshots ?? []) {
      const u = s.player_username;
      let xp = 0;
      if (skillId <= 0) {
        xp = s.total_xp ?? 0;
      } else {
        try {
          const data = typeof s.snapshot_data === 'string'
            ? JSON.parse(s.snapshot_data)
            : s.snapshot_data;
          const skill = data?.skills?.find((sk: { id: number }) => sk.id === skillId);
          xp = parseInt(skill?.xp ?? '0') || 0;
        } catch {
          xp = 0;
        }
      }
      if (!(u in firstSnap)) firstSnap[u] = xp;
      if (!(u in minSnap) || xp < minSnap[u]) minSnap[u] = xp;
      lastSnap[u] = xp;
    }

    const gains = usernames.map((u) => ({
      username: u,
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
    }));
    gains.sort((a, b) => b.xp_gained - a.xp_gained);

    const myIndex = gains.findIndex((g) => g.username === decoded);
    const myGain = gains[myIndex] ?? { xp_gained: 0 };

    compStandings[comp.id] = {
      rank: myIndex >= 0 ? myIndex + 1 : gains.length + 1,
      xp_gained: myGain.xp_gained,
      total_participants: gains.length,
    };
  }

  // 6. Build response
  const roleMap: Record<string, string> = {};
  const joinedMap: Record<string, string | null> = {};
  for (const m of memberships) {
    roleMap[m.group_id] = m.role;
    joinedMap[m.group_id] = m.joined_at;
  }

  const result = (groups ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    slug: g.slug,
    description: g.description,
    is_private: g.is_private,
    role: roleMap[g.id] ?? 'member',
    joined_at: joinedMap[g.id] ?? null,
    member_count: countMap[g.id] ?? 1,
    active_competitions: (competitions ?? [])
      .filter((c) => c.group_id === g.id)
      .map((c) => ({
        id: c.id,
        name: c.name,
        metric: c.metric,
        starts_at: c.starts_at,
        ends_at: c.ends_at,
        is_active: c.starts_at <= now,
        standing: compStandings[c.id] ?? null,
      })),
  }));

  return NextResponse.json(result);
}
