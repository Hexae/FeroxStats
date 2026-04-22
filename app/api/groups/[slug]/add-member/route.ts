import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase-service';
import { createClient as createServerClient } from '@/lib/supabase-server';

type Params = { params: Promise<{ slug: string }> };

// POST /api/groups/[slug]/add-member  { username }
// Owner or admin can add any player by username directly
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

  // Verify the target player exists
  const { data: targetPlayer } = await supabase
    .from('players').select('username, display_name').eq('username', targetUsername).single();
  if (!targetPlayer) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

  // Check already a member
  const { data: existing } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', group.id)
    .eq('username', targetUsername)
    .single();
  if (existing) return NextResponse.json({ error: 'Player is already a member' }, { status: 409 });

  const { error } = await supabase
    .from('group_members')
    .insert({ group_id: group.id, username: targetUsername, role: 'member' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, player: targetPlayer });
}
