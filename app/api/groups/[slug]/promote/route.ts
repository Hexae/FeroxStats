import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase-service';
import { createClient as createServerClient } from '@/lib/supabase-server';
import type { Database } from '@/lib/database.types';

type MemberUpdate = Database['public']['Tables']['group_members']['Update'];

type Params = { params: Promise<{ slug: string }> };

// POST /api/groups/[slug]/promote  { username, role: 'admin' | 'member' | 'owner' }
export async function POST(request: NextRequest, { params }: Params) {
  const { slug } = await params;
  const authClient = await createServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await request.json() as { username?: string; role?: string; rank_slot?: number | null; rank_icon_id?: string | null };
  const targetUsername = body.username?.toLowerCase().trim();
  const newRole = body.role;
  const rankSlot = 'rank_slot' in body ? body.rank_slot : undefined;
  const rankIconId = 'rank_icon_id' in body ? body.rank_icon_id : undefined;

  if (!targetUsername) return NextResponse.json({ error: 'username required' }, { status: 400 });
  // role is optional if only updating rank_slot/rank_icon_id
  if (newRole !== undefined && !['owner', 'admin', 'member'].includes(newRole)) {
    return NextResponse.json({ error: 'role must be owner, admin, or member' }, { status: 400 });
  }
  if (rankSlot !== undefined && rankSlot !== null && (typeof rankSlot !== 'number' || !Number.isInteger(rankSlot) || rankSlot < 1 || rankSlot > 27)) {
    return NextResponse.json({ error: 'rank_slot must be an integer 1-27 or null' }, { status: 400 });
  }

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

  // Only owner can promote to admin or transfer ownership
  if (newRole !== undefined && (newRole === 'admin' || newRole === 'owner') && callerMember.role !== 'owner') {
    return NextResponse.json({ error: 'Only the owner can promote to admin or transfer ownership' }, { status: 403 });
  }

  const { data: targetMember } = await supabase
    .from('group_members').select('role').eq('group_id', group.id).eq('username', targetUsername).single();
  if (!targetMember) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  if (newRole !== undefined && targetMember.role === 'owner' && newRole !== 'owner') {
    return NextResponse.json({ error: 'Cannot demote the owner; transfer ownership first' }, { status: 400 });
  }

  // Transfer ownership: demote caller to admin
  if (newRole === 'owner') {
    await supabase
      .from('group_members')
      .update({ role: 'admin' })
      .eq('group_id', group.id)
      .eq('username', callerPlayer.username);
  }

  const memberUpdate: MemberUpdate = {};
  if (newRole !== undefined) memberUpdate.role = newRole;
  if (rankSlot !== undefined) memberUpdate.rank_slot = rankSlot ?? null;
  if (rankIconId !== undefined) memberUpdate.rank_icon_id = rankIconId ?? null;

  if (Object.keys(memberUpdate).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { error } = await supabase
    .from('group_members')
    .update(memberUpdate)
    .eq('group_id', group.id)
    .eq('username', targetUsername);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log role-change event only when role actually changed
  if (newRole !== undefined) {
    const effectiveOldRole = targetMember.role;
    const eventType = newRole === 'owner' ? 'member_promoted' :
      (effectiveOldRole === 'member' && newRole === 'admin') ? 'member_promoted' : 'member_demoted';
    await supabase.from('group_events').insert({
      group_id: group.id,
      event_type: eventType,
      actor: callerPlayer.username,
      target: targetUsername,
      metadata: { new_role: newRole },
    });
  }

  return NextResponse.json({ success: true });
}
