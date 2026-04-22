import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/admin-auth';

// POST /api/admin/toggle-admin — toggle a user's admin status
export async function POST(request: NextRequest) {
  const { supabase, error: authError } = await getAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: authError }, { status: 403 });
  }

  const { userId, isAdmin } = await request.json();

  if (!userId || typeof isAdmin !== 'boolean') {
    return NextResponse.json({ error: 'Missing userId or isAdmin' }, { status: 400 });
  }

  const { error } = await supabase
    .from('user_profiles')
    .update({ is_admin: isAdmin })
    .eq('id', userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
