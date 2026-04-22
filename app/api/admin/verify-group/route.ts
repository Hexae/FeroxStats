import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/admin-auth';
import { serviceClient } from '@/lib/supabase-service';

// POST /api/admin/verify-group — toggle discord_verified on a group
export async function POST(request: NextRequest) {
  const { error: authError } = await getAdminClient();
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 403 });
  }

  const { groupId, verified } = await request.json();

  if (!groupId || typeof verified !== 'boolean') {
    return NextResponse.json({ error: 'Missing groupId or verified' }, { status: 400 });
  }

  const { error } = await serviceClient()
    .from('groups')
    .update({ discord_verified: verified })
    .eq('id', groupId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
