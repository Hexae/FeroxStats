import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/admin-auth';

// POST /api/admin/unclaim — unclaim a player
export async function POST(request: NextRequest) {
  const { supabase, error: authError } = await getAdminClient();
  if (!supabase) {
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

  return NextResponse.json({ ok: true });
}
