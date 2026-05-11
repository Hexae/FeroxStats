import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase-service';
import { createClient as createServerClient } from '@/lib/supabase-server';
import { SKILL_NAMES } from '@/lib/api-utils';

type Params = { params: Promise<{ slug: string; compId: string }> };

// GET /api/groups/[slug]/competitions/[compId]  — competition detail + standings
export async function GET(_req: NextRequest, { params }: Params) {
  const { slug, compId } = await params;
  const supabase = serviceClient();

  const { data: group } = await supabase.from('groups').select('id').eq('slug', slug).single();
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

  const { data: comp } = await supabase
    .from('group_competitions').select('*').eq('id', compId).eq('group_id', group.id).single();
  if (!comp) return NextResponse.json({ error: 'Competition not found' }, { status: 404 });

  // Get group members
  const { data: members } = await supabase
    .from('group_members').select('username').eq('group_id', group.id);
  if (!members || members.length === 0) {
    return NextResponse.json({ ...comp, standings: [] });
  }

  const usernames = members.map(m => m.username);

  // Get player display names
  const { data: players } = await supabase
    .from('players').select('username, display_name').in('username', usernames);
  const nameMap: Record<string, string> = {};
  for (const p of players ?? []) nameMap[p.username] = p.display_name;

  // Map metric to skill id
  const skillId = (SKILL_NAMES as readonly string[]).indexOf(comp.metric);

  // Fetch snapshots within competition window
  const { data: snapshots } = await supabase
    .from('player_snapshots')
    .select('player_username, total_xp, snapshot_data, created_at')
    .in('player_username', usernames)
    .gte('created_at', comp.starts_at)
    .lte('created_at', comp.ends_at)
    .order('created_at', { ascending: true });

  // Calculate XP gained per member
  const firstSnap: Record<string, number> = {};
  const minSnap: Record<string, number> = {};
  const lastSnap: Record<string, number> = {};

  for (const s of snapshots ?? []) {
    const u = s.player_username;
    let xp = 0;
    if (skillId === 0 || comp.metric === 'overall') {
      xp = s.total_xp ?? 0;
    } else {
      try {
        const data = typeof s.snapshot_data === 'string' ? JSON.parse(s.snapshot_data) : s.snapshot_data;
        const skill = data?.skills?.find((sk: { id: number; xp: number }) => sk.id === skillId);
        xp = skill?.xp ?? 0;
      } catch {
        xp = 0;
      }
    }
    if (!(u in firstSnap)) firstSnap[u] = xp;
    if (!(u in minSnap) || xp < minSnap[u]) minSnap[u] = xp;
    lastSnap[u] = xp;
  }

  const standings = usernames.map(u => ({
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
  }));

  standings.sort((a, b) => b.xp_gained - a.xp_gained);

  return NextResponse.json({ ...comp, standings });
}

// DELETE /api/groups/[slug]/competitions/[compId]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { slug, compId } = await params;
  const authClient = await createServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const supabase = serviceClient();

  const { data: group } = await supabase.from('groups').select('id').eq('slug', slug).single();
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

  const { data: callerPlayer } = await supabase
    .from('players').select('username').eq('claimed_by', user.id).single();
  if (!callerPlayer) return NextResponse.json({ error: 'No claimed player' }, { status: 403 });

  const { data: callerMember } = await supabase
    .from('group_members').select('role').eq('group_id', group.id).eq('username', callerPlayer.username).single();
  if (!callerMember || callerMember.role === 'member') {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { error } = await supabase
    .from('group_competitions').delete().eq('id', compId).eq('group_id', group.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
