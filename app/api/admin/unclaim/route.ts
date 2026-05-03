import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/admin-auth';
import { serviceClient } from '@/lib/supabase-service';

// POST /api/admin/unclaim — unclaim a player
export async function POST(request: NextRequest) {
  const { supabase, user, error: authError } = await getAdminClient();
  if (!supabase || !user) {
    return NextResponse.json({ error: authError }, { status: 403 });
  }

  const { username } = await request.json();

  if (!username) {
    return NextResponse.json({ error: 'Missing username' }, { status: 400 });
  }

  const { error } = await supabase
    .from('players')
    .update({ claimed_by: null, claimed_at: null })
    .eq('username', username);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const svc = serviceClient();
  await svc.from('admin_action_log').insert({
    admin_id: user.id,
    admin_email: user.email ?? null,
    target_username: username,
    action: 'unclaim',
    detail: 'Profile unclaimed by admin',
  });

  return NextResponse.json({ ok: true });
}
