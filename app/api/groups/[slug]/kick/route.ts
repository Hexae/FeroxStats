import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase-service';
import { createClient as createServerClient } from '@/lib/supabase-server';

type Params = { params: Promise<{ slug: string }> };

// POST /api/groups/[slug]/kick  { username }
export async function POST(request: NextRequest, { params }: Params) {
  const { slug } = await params;
  const authClient = await createServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await request.json() as { username?: string };
  const targetUsername = body.username?.toLowerCase().trim();
  if (!targetUsername) return NextResponse.json({ error: 'username required' }, { status: 400 });

  const supabase = serviceClient();

  const { data: group } = await supabase.from('groups').select('id').eq('slug', slug).single();
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

  const { data: callerPlayer } = await supabase
    .from('players').select('username').eq('claimed_by', user.id).single();
  if (!callerPlayer) return NextResponse.json({ error: 'No claimed player found' }, { status: 403 });

  const { data: callerMember } = await supabase
    .from('group_members').select('role').eq('group_id', group.id).eq('username', callerPlayer.username).single();
  if (!callerMember || callerMember.role === 'member') {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  // Can't kick the owner
  const { data: targetMember } = await supabase
    .from('group_members').select('role').eq('group_id', group.id).eq('username', targetUsername).single();
  if (!targetMember) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  if (targetMember.role === 'owner') return NextResponse.json({ error: 'Cannot kick the group owner' }, { status: 400 });

  // Admin can't kick other admins, only owner can
  if (targetMember.role === 'admin' && callerMember.role !== 'owner') {
    return NextResponse.json({ error: 'Only the owner can remove admins' }, { status: 403 });
  }

  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', group.id)
    .eq('username', targetUsername);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log event
  await supabase.from('group_events').insert({
    group_id: group.id,
    event_type: 'member_kicked',
    actor: callerPlayer.username,
    target: targetUsername,
  });

  return NextResponse.json({ success: true });
}
