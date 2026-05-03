import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/admin-auth';
import { isValidGameMode } from '@/lib/api-utils';
import { serviceClient } from '@/lib/supabase-service';

// POST /api/admin/gamemode — update a player's game mode
export async function POST(request: NextRequest) {
  const { supabase, user, error: authError } = await getAdminClient();
  if (!supabase || !user) {
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

  // Log the action (service client bypasses RLS on the log table)
  const svc = serviceClient();
  await svc.from('admin_action_log').insert({
    admin_id: user.id,
    admin_email: user.email ?? null,
    target_username: username,
    action: 'gamemode_change',
    detail: `Set game mode to ${game_mode}`,
  });

  return NextResponse.json({ ok: true });
}
