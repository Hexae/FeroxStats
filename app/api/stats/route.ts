import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase-service';

export async function GET() {
  const db = serviceClient();

  const [{ count }, { data: top3 }] = await Promise.all([
    db.from('players').select('*', { count: 'exact', head: true }),
    db.from('players')
      .select('display_name, overall_rank')
      .gt('overall_rank', 0)
      .order('overall_rank', { ascending: true })
      .limit(3),
  ]);

  return NextResponse.json(
    {
      playerCount: count ?? 0,
      topPlayers: (top3 ?? []).map(p => p.display_name),
      rank1: top3?.[0]?.display_name ?? 'N/A',
    },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
  );
}
