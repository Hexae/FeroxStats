import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase-service';

// GET /api/player/[username]/milestones?limit=50
// Returns the most recent level-up events recorded by the tracker.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const decoded = decodeURIComponent(username).toLowerCase();
  const limit = Math.min(
    parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10),
    200,
  );

  const supabase = serviceClient();

  const { data, error } = await supabase
    .from('player_milestones')
    .select('id, skill_id, skill_name, old_level, new_level, xp, achieved_at')
    .eq('player_username', decoded)
    .order('achieved_at', { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ milestones: data ?? [] });
}
