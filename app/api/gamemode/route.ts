import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { GameModeKey, GAME_MODES } from '@/lib/osrs';

const VALID_MODES = new Set(GAME_MODES.map(m => m.key));

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json() as { game_mode?: GameModeKey };
  const { game_mode } = body;

  if (!game_mode || !VALID_MODES.has(game_mode)) {
    return NextResponse.json({ error: 'Invalid game_mode' }, { status: 400 });
  }

  const { error } = await supabase
    .from('players')
    .update({ game_mode })
    .eq('claimed_by', user.id);

  if (error) {
    return NextResponse.json({ error: 'Failed to update game mode.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
