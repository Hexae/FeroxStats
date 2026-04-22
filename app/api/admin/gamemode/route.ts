import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/admin-auth';
import { isValidGameMode } from '@/lib/api-utils';

// POST /api/admin/gamemode — update a player's game mode
export async function POST(request: NextRequest) {
  const { supabase, error: authError } = await getAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: authError }, { status: 403 });
  }

  const body = await request.json();
  const { username, game_mode } = body;

  if (!username || !game_mode) {
    return NextResponse.json({ error: 'Missing username or game_mode' }, { status: 400 });
  }

  if (!isValidGameMode(game_mode)) {
    return NextResponse.json({ error: 'Invalid game_mode' }, { status: 400 });
  }

  const { error } = await supabase
    .from('players')
    .update({ game_mode })
    .eq('username', username);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
