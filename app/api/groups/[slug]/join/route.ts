import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase-service';
import { createClient as createServerClient } from '@/lib/supabase-server';

type Params = { params: Promise<{ slug: string }> };

// POST /api/groups/[slug]/join
export async function POST(_req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const authClient = await createServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const supabase = serviceClient();

  // Get group
  const { data: group } = await supabase.from('groups').select('id, is_private').eq('slug', slug).single();
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

  // Get claimed player
  const { data: player } = await supabase
    .from('players').select('username').eq('claimed_by', user.id).single();
  if (!player) {
    return NextResponse.json({ error: 'You must claim a player profile before joining a group.' }, { status: 400 });
  }

  // Check already a member
  const { data: existing } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', group.id)
    .eq('username', player.username)
    .single();
  if (existing) return NextResponse.json({ error: 'Already a member of this group' }, { status: 409 });

  // Private groups require a join request instead
  if (group.is_private) {
    return NextResponse.json(
      { error: 'This group is private. Submit a join request instead.', require_request: true },
      { status: 403 }
    );
  }

  const { error } = await supabase
    .from('group_members')
    .insert({ group_id: group.id, username: player.username, role: 'member' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log event
  await supabase.from('group_events').insert({
    group_id: group.id,
    event_type: 'member_joined',
    actor: player.username,
  });

  return NextResponse.json({ success: true });
}
