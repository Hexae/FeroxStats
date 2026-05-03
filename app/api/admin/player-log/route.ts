import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/admin-auth';

// GET /api/admin/player-log?username=xxx
export async function GET(request: NextRequest) {
  const { supabase, error: authError } = await getAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: authError }, { status: 403 });
  }

  const username = request.nextUrl.searchParams.get('username');
  if (!username) {
    return NextResponse.json({ error: 'Missing username' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('admin_action_log')
    .select('id, action, detail, admin_email, created_at')
    .eq('target_username', username)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ log: data ?? [] });
}
