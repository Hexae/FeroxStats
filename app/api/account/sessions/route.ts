import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { serviceClient } from '@/lib/supabase-service';
import { reauthValidUntil } from '@/lib/account-security';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const db = serviceClient();
  const { data: profile } = await db
    .from('user_profiles')
    .select('last_reauth_at')
    .eq('id', user.id)
    .single();

  const currentSession = session
    ? {
        id: session.access_token.slice(-12),
        current: true,
        userAgent: request.headers.get('user-agent') ?? 'Unknown device',
        lastSignInAt: user.last_sign_in_at ?? null,
        expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
      }
    : null;

  return NextResponse.json({
    sessions: currentSession ? [currentSession] : [],
    lastReauthAt: profile?.last_reauth_at ?? null,
    reauthValidUntil: reauthValidUntil(profile?.last_reauth_at ?? null),
  });
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { error } = await supabase.auth.signOut({ scope: 'global' });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
