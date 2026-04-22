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
      .select('display_name, overall_rank, total_level, total_xp')
      .gt('overall_rank', 0)
      .order('overall_rank', { ascending: true })
      .limit(limit);

    if (error) return NextResponse.json({ hiscores: [] });

    return NextResponse.json({
      hiscores: (data ?? []).map(p => ({
        rank: p.overall_rank,
        name: p.display_name,
        level: p.total_level,
        xp: p.total_xp,
      })),
    });
  }

  // ── Per-skill hiscores: extract from cached player snapshots ─────────────────
  const skillObj = SKILLS.find(s => s.name.toLowerCase() === skill);
  if (!skillObj) return NextResponse.json({ hiscores: [] });
  const skillId = skillObj.id;

  // Fetch latest snapshots (most recent first), deduplicate by player
  const { data: snapshots, error } = await supabase
    .from('player_snapshots')
    .select('player_username, snapshot_data, created_at')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error || !snapshots) return NextResponse.json({ hiscores: [] });

  // Build a display_name map from the players table
  const usernames = [...new Set(snapshots.map(s => s.player_username))];
  const { data: playerRows } = await supabase
    .from('players')
    .select('username, display_name')
    .in('username', usernames);
  const displayNames: Record<string, string> = {};
  for (const p of playerRows ?? []) {
    displayNames[p.username] = p.display_name ?? p.username;
  }

  const seen = new Set<string>();
  type SkillRow = { rank: number; name: string; level: number; xp: number };
  const results: SkillRow[] = [];

  for (const snap of snapshots) {
    if (seen.has(snap.player_username)) continue;
    seen.add(snap.player_username);

    const skills = (snap.snapshot_data as { skills?: Array<{ id: number; rank: number; level: number; xp: string }> } | null)?.skills;
    if (!skills) continue;

    const s = skills.find(sk => sk.id === skillId);
    if (!s || s.rank <= 0) continue;

    results.push({
      rank: s.rank,
      name: displayNames[snap.player_username] ?? snap.player_username,
      level: s.level,
      xp: parseInt(s.xp),
    });
  }

  results.sort((a, b) => a.rank - b.rank);

  return NextResponse.json({ hiscores: results.slice(0, limit) });
}
