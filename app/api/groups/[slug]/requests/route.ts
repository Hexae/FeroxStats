import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase-service';
import { createClient as createServerClient } from '@/lib/supabase-server';

type Params = { params: Promise<{ slug: string }> };

// GET /api/groups/[slug]/requests — list pending requests (for owner/admin)
export async function GET(_req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const authClient = await createServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const supabase = serviceClient();

  const { data: group } = await supabase.from('groups').select('id').eq('slug', slug).single();
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

  // Verify caller is owner/admin
  const { data: callerPlayer } = await supabase
    .from('players').select('username').eq('claimed_by', user.id).single();
  if (!callerPlayer) return NextResponse.json({ error: 'No claimed player' }, { status: 403 });

  const { data: callerMember } = await supabase
    .from('group_members').select('role').eq('group_id', group.id).eq('username', callerPlayer.username).single();
  if (!callerMember || callerMember.role === 'member') {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('group_join_requests')
    .select('*')
    .eq('group_id', group.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with display names
  const usernames = (data ?? []).map(r => r.username);
  const nameMap: Record<string, string> = {};
  if (usernames.length > 0) {
    const { data: players } = await supabase
      .from('players').select('username, display_name').in('username', usernames);
    for (const p of players ?? []) nameMap[p.username] = p.display_name;
  }

  const enriched = (data ?? []).map(r => ({
    ...r,
    display_name: nameMap[r.username] ?? r.username,
  }));

  return NextResponse.json(enriched);
}

// POST /api/groups/[slug]/requests — submit a join request (for private groups)
export async function POST(request: NextRequest, { params }: Params) {
  const { slug } = await params;
  const authClient = await createServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const supabase = serviceClient();

  const { data: group } = await supabase.from('groups').select('id, is_private').eq('slug', slug).single();
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

  const { data: player } = await supabase
    .from('players').select('username').eq('claimed_by', user.id).single();
  if (!player) return NextResponse.json({ error: 'You must claim a player profile first.' }, { status: 400 });

  // Check already a member
  const { data: existing } = await supabase
    .from('group_members').select('id').eq('group_id', group.id).eq('username', player.username).single();
  if (existing) return NextResponse.json({ error: 'Already a member' }, { status: 409 });

  // Check for existing pending request
  const { data: pendingReq } = await supabase
    .from('group_join_requests')
    .select('id')
    .eq('group_id', group.id)
    .eq('username', player.username)
    .eq('status', 'pending')
    .single();
  if (pendingReq) return NextResponse.json({ error: 'You already have a pending request' }, { status: 409 });

  const body = await request.json().catch(() => ({})) as { message?: string };
  const { error } = await supabase
    .from('group_join_requests')
    .insert({
      group_id: group.id,
      username: player.username,
      message: (body.message ?? '').slice(0, 200),
    });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true }, { status: 201 });
}
