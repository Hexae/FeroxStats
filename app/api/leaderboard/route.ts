import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sort = searchParams.get('sort') ?? 'overall_rank';

  const allowed = ['overall_rank', 'total_level', 'total_xp'];
  const orderCol = allowed.includes(sort) ? sort : 'overall_rank';
  const ascending = orderCol === 'overall_rank';

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('players')
      .select('username, display_name, total_level, total_xp, overall_rank, updated_at')
      .order(orderCol, { ascending })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message ?? JSON.stringify(error) }, { status: 500 });
    }
    return NextResponse.json(data ?? []);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : JSON.stringify(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
