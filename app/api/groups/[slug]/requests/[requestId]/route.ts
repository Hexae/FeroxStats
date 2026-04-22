import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase-service';
import { createClient as createServerClient } from '@/lib/supabase-server';

type Params = { params: Promise<{ slug: string; requestId: string }> };

// PATCH /api/groups/[slug]/requests/[requestId]  { action: 'approve' | 'deny' }
export async function PATCH(request: NextRequest, { params }: Params) {
  const { slug, requestId } = await params;
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

  const body = await request.json() as { action?: string };
  if (!body.action || !['approve', 'deny'].includes(body.action)) {
    return NextResponse.json({ error: 'action must be approve or deny' }, { status: 400 });
  }

  // Get the request
  const { data: joinReq } = await supabase
    .from('group_join_requests')
    .select('*')
    .eq('id', requestId)
    .eq('group_id', group.id)
    .eq('status', 'pending')
    .single();

  if (!joinReq) return NextResponse.json({ error: 'Request not found or already resolved' }, { status: 404 });

  const newStatus = body.action === 'approve' ? 'approved' : 'denied';

  // Update request status
  const { error: updateErr } = await supabase
    .from('group_join_requests')
    .update({
      status: newStatus,
      resolved_by: callerPlayer.username,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // If approved, add as member (idempotent — handles race condition)
  if (body.action === 'approve') {
    const { error: memberErr } = await supabase
      .from('group_members')
      .upsert(
        { group_id: group.id, username: joinReq.username, role: 'member' },
        { onConflict: 'group_id,username', ignoreDuplicates: true }
      );

    if (memberErr) {
      // Revert request status if member insert fails
      await supabase.from('group_join_requests').update({ status: 'pending', resolved_by: null, resolved_at: null }).eq('id', requestId);
      return NextResponse.json({ error: memberErr.message }, { status: 500 });
    }

    // Log event
    await supabase.from('group_events').insert({
      group_id: group.id,
      event_type: 'request_approved',
      actor: callerPlayer.username,
      target: joinReq.username,
    });
  } else {
    await supabase.from('group_events').insert({
      group_id: group.id,
      event_type: 'request_denied',
      actor: callerPlayer.username,
      target: joinReq.username,
    });
  }

  return NextResponse.json({ success: true, status: newStatus });
}
