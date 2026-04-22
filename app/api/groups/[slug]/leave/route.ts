import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase-service';
import { createClient as createServerClient } from '@/lib/supabase-server';

type Params = { params: Promise<{ slug: string }> };

// POST /api/groups/[slug]/leave
export async function POST(_req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const authClient = await createServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const supabase = serviceClient();

  const { data: group } = await supabase.from('groups').select('id').eq('slug', slug).single();
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

  const { data: player } = await supabase
    .from('players').select('username').eq('claimed_by', user.id).single();
  if (!player) return NextResponse.json({ error: 'No claimed player found' }, { status: 400 });

  const { data: member } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', group.id)
    .eq('username', player.username)
    .single();

  if (!member) return NextResponse.json({ error: 'You are not a member of this group' }, { status: 404 });

  if (member.role === 'owner') {
    // Check if there are other members
    const { data: members } = await supabase
      .from('group_members')
      .select('username, role')
      .eq('group_id', group.id);

    if ((members ?? []).length > 1) {
      return NextResponse.json(
        { error: 'Transfer ownership to another member or remove all other members before leaving.' },
        { status: 400 }
      );
    }
    // Sole member — delete the group
    await supabase.from('groups').delete().eq('id', group.id);
    return NextResponse.json({ success: true, group_deleted: true });
  }

  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', group.id)
    .eq('username', player.username);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log event
  await supabase.from('group_events').insert({
    group_id: group.id,
    event_type: 'member_left',
    actor: player.username,
  });

  return NextResponse.json({ success: true });
}
