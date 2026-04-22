import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { GameModeKey } from '@/lib/osrs';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json() as { username?: string; game_mode?: GameModeKey };
  const { username, game_mode } = body;

  if (!username || typeof username !== 'string') {
    return NextResponse.json({ error: 'Username required' }, { status: 400 });
  }

  const normalised = username.toLowerCase().trim();

  // Check player exists in our DB
  const { data: player, error: lookupErr } = await supabase
    .from('players')
    .select('username, claimed_by')
    .eq('username', normalised)
    .single();

  if (lookupErr || !player) {
    return NextResponse.json({ error: 'Player not found. Search for them first to load their profile.' }, { status: 404 });
  }

  if (player.claimed_by && player.claimed_by !== user.id) {
    return NextResponse.json({ error: 'This profile is already claimed by another account.' }, { status: 409 });
  }

  // Check this user hasn't already claimed a different profile
  const { data: existing } = await supabase
    .from('players')
    .select('username')
    .eq('claimed_by', user.id)
    .neq('username', normalised)
    .limit(1)
    .single();

  if (existing) {
    return NextResponse.json({ error: `You already claimed the profile "${existing.username}". Unclaim it first.` }, { status: 409 });
  }

  const { error: updateErr } = await supabase
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
