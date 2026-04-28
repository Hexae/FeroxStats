import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { serviceClient } from '@/lib/supabase-service';
import { isRecentReauth, reauthValidUntil } from '@/lib/account-security';

type Payload =
  | { action: 'change-email'; newEmail?: string }
  | { action: 'change-password'; newPassword?: string }
  | { action: 'send-password-reset' };

function isLikelyEmail(value: string): boolean {
  return /.+@.+\..+/.test(value);
}

export async function POST(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const db = serviceClient();
  const { data: profile } = await db
    .from('user_profiles')
    .select('last_reauth_at')
    .eq('id', user.id)
    .single();

  if (!isRecentReauth(profile?.last_reauth_at ?? null)) {
    return NextResponse.json(
      {
        error: 'Re-authentication required',
        validUntil: reauthValidUntil(profile?.last_reauth_at ?? null),
      },
      { status: 403 },
    );
  }

  const body = (await request.json()) as Payload;

  if (body.action === 'change-email') {
    const newEmail = body.newEmail?.trim().toLowerCase();
    if (!newEmail || !isLikelyEmail(newEmail)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const { error: updateError } = await supabase.auth.updateUser(
      { email: newEmail },
      { emailRedirectTo: `${origin}/auth/callback?next=/account` },
    );
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    await db
      .from('user_profiles')
      .upsert(
        {
          id: user.id,
          email: newEmail,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );

    return NextResponse.json({ success: true, message: 'Email change requested. Check your inbox.' });
  }

  if (body.action === 'send-password-reset') {
    if (!user.email) {
      return NextResponse.json({ error: 'User email is missing' }, { status: 400 });
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${origin}/auth/callback?next=/auth/reset-password`,
    });

    if (resetError) {
      return NextResponse.json({ error: resetError.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Password reset email sent. Check your inbox.',
    });
  }

  if (body.action === 'change-password') {
    const nextPassword = body.newPassword ?? '';
    if (nextPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: nextPassword });
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Password updated.' });
  }

  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
}
