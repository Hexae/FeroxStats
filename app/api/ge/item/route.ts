import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase-service';

// GET /api/ge/item?name=Abyssal+whip&limit=100
export async function GET(request: NextRequest) {
  const name  = request.nextUrl.searchParams.get('name');
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') ?? '150', 10), 10000);

  if (!name) {
    return NextResponse.json({ error: 'name param required' }, { status: 400 });
  }

  const supabase = serviceClient();

  const { data, error } = await supabase
    .from('trade_history')
    .select('id, source, quantity, price_each, total_value, type, traded_at')
    .ilike('item_name', name)
    .order('traded_at', { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ history: data ?? [] });
}
