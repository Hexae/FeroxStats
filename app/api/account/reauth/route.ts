import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { serviceClient } from '@/lib/supabase-service';
import { REAUTH_WINDOW_MINUTES } from '@/lib/account-security';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = (await request.json()) as { password?: string };
  const password = body.password?.trim();

  if (!password) {
    return NextResponse.json({ error: 'Password is required' }, { status: 400 });
  }

  if (!user.email) {
    return NextResponse.json({ error: 'User email is missing' }, { status: 400 });
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  });

  if (signInError) {
    return NextResponse.json({ error: 'Password verification failed' }, { status: 401 });
  }

  const nowIso = new Date().toISOString();
  const validUntil = new Date(Date.now() + REAUTH_WINDOW_MINUTES * 60 * 1000).toISOString();

  const db = serviceClient();
  await db
    .from('user_profiles')
    .upsert(
      {
        id: user.id,
        email: user.email ?? null,
        last_reauth_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: 'id' },
    );

  return NextResponse.json({ success: true, validUntil });
}
