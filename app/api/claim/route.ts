import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { serviceClient } from '@/lib/supabase-service';
import { GameModeKey } from '@/lib/osrs';
import { getClaimCooldownRemainingMs, isRecentReauth, UNCLAIM_COOLDOWN_HOURS } from '@/lib/account-security';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json() as {
    username?: string;
    game_mode?: GameModeKey;
    verification_total_level?: number;
    verification_rank?: number;
  };
  const { username, game_mode, verification_total_level, verification_rank } = body;

  if (!username || typeof username !== 'string') {
    return NextResponse.json({ error: 'Username required' }, { status: 400 });
  }

  if (!Number.isFinite(verification_total_level) || !Number.isFinite(verification_rank)) {
    return NextResponse.json(
      { error: 'Verification rank and total level are required.' },
      { status: 400 },
    );
  }

  const normalised = username.toLowerCase().trim();
  const db = serviceClient();

  const { data: profile } = await db
    .from('user_profiles')
    .select('last_reauth_at, last_unclaim_at')
    .eq('id', user.id)
    .single();

  if (!isRecentReauth(profile?.last_reauth_at ?? null)) {
    return NextResponse.json(
      { error: 'Please verify your password in Security Center before claiming.' },
      { status: 403 },
    );
  }

  const cooldownRemainingMs = getClaimCooldownRemainingMs(profile?.last_unclaim_at ?? null);
  if (cooldownRemainingMs > 0) {
    const minutes = Math.ceil(cooldownRemainingMs / 60_000);
    return NextResponse.json(
      {
        error: `Claim cooldown active. You can claim again in about ${minutes} minute(s).`,
        cooldownHours: UNCLAIM_COOLDOWN_HOURS,
      },
      { status: 429 },
    );
  }

  // Check player exists in our DB
  const { data: player, error: lookupErr } = await db
    .from('players')
    .select('username, claimed_by, total_level, overall_rank')
    .eq('username', normalised)
    .single();

  if (lookupErr || !player) {
    return NextResponse.json({ error: 'Player not found. Search for them first to load their profile.' }, { status: 404 });
  }

  if (
    Number(player.total_level) !== Number(verification_total_level)
    || Number(player.overall_rank) !== Number(verification_rank)
  ) {
    return NextResponse.json(
      {
        error: 'Verification failed. Rank/total level did not match current profile data.',
      },
      { status: 403 },
    );
  }

  if (player.claimed_by && player.claimed_by !== user.id) {
    return NextResponse.json({ error: 'This profile is already claimed by another account.' }, { status: 409 });
  }

  // Check this user hasn't already claimed a different profile
  const { data: existing } = await db
    .from('players')
    .select('username')
    .eq('claimed_by', user.id)
    .neq('username', normalised)
    .limit(1)
    .single();

  if (existing) {
    return NextResponse.json({ error: `You already claimed the profile "${existing.username}". Unclaim it first.` }, { status: 409 });
  }

  const { error: updateErr } = await db
    .from('players')
    .update({
      claimed_by: user.id,
      claimed_at: new Date().toISOString(),
      game_mode: game_mode ?? 'regular',
    })
    .eq('username', normalised);

  if (updateErr) {
    return NextResponse.json({ error: 'Failed to claim profile.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, username: normalised });
}
