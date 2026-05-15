import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase-service';
import { rateLimit } from '@/lib/api-utils';
import { SKILLS } from '@/lib/osrs';

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
  const limited = rateLimit(`hiscores:${ip}`, { limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  const supabase = serviceClient();
  const { searchParams } = new URL(request.url);
  const skill = (searchParams.get('skill') ?? 'overall').toLowerCase();
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '25', 10), 100);

  // ── Overall hiscores: query players table directly ──────────────────────────
  if (skill === 'overall') {
    const { data, error } = await supabase
      .from('players')
      .select('username, display_name, game_mode, overall_rank, total_level, total_xp')
      .gt('overall_rank', 0)
      .order('overall_rank', { ascending: true })
      .limit(limit);

    if (error) return NextResponse.json({ hiscores: [] });

    return NextResponse.json({
      hiscores: (data ?? []).map(p => ({
        rank: p.overall_rank,
        username: p.username,
        name: p.display_name,
        game_mode: p.game_mode ?? 'regular',
        level: p.total_level,
        xp: p.total_xp,
      })),
    });
  }

  // ── Per-skill hiscores: use a server-side DB function ──
  const skillObj = SKILLS.find(s => s.name.toLowerCase() === skill);
  if (!skillObj) return NextResponse.json({ hiscores: [] }, { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' } });
  const skillId = skillObj.id;

  const { data: rows, error: rpcError } = await supabase.rpc('get_skill_hiscores', {
    p_skill_id: skillId,
    p_limit: limit,
  });

  if (rpcError || !rows) return NextResponse.json({ hiscores: [] }, { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' } });

  return NextResponse.json(
    {
      hiscores: (rows as Array<{ username: string; display_name: string; game_mode: string; skill_rank: number; skill_level: number; skill_xp: number }>).map(r => ({
        rank: r.skill_rank,
        username: r.username,
        name: r.display_name,
        game_mode: r.game_mode,
        level: r.skill_level,
        xp: r.skill_xp,
      })),
    },
    { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' } },
  );
}
