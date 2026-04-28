import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { serviceClient } from '@/lib/supabase-service';
import { isRecentReauth } from '@/lib/account-security';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json() as { confirmText?: string };

  const db = serviceClient();
  const { data: profile } = await db
    .from('user_profiles')
    .select('last_reauth_at')
    .eq('id', user.id)
    .single();

  if (!isRecentReauth(profile?.last_reauth_at ?? null)) {
    return NextResponse.json(
      { error: 'Please verify your password in Security Center before unlinking.' },
      { status: 403 },
    );
  }

  const { data: claimedPlayer } = await db
    .from('players')
    .select('username')
    .eq('claimed_by', user.id)
    .single();

  if (!claimedPlayer) {
    return NextResponse.json({ error: 'No claimed profile found.' }, { status: 400 });
  }

  const expected = `UNLINK ${claimedPlayer.username.toUpperCase()}`;
  if ((body.confirmText ?? '').trim() !== expected) {
    return NextResponse.json(
      {
        error: 'Confirmation text does not match.',
        expected,
      },
      { status: 400 },
    );
  }

  // Only unlink the player that belongs to this user
  const { error } = await db
    .from('players')
    .update({ claimed_by: null, claimed_at: null, cover_screenshot_id: null })
    .eq('claimed_by', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await db
    .from('user_profiles')
    .upsert(
      {
        id: user.id,
        email: user.email ?? null,
        last_unclaim_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );

  return NextResponse.json({ success: true });
}
