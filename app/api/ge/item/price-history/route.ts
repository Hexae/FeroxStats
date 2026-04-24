import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase-service';

// GET /api/ge/item/price-history?name=<item_name>&limit=200
// Returns the tracker-sampled price history for an item from ge_price_history.
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name');
  const limit = Math.min(
    parseInt(req.nextUrl.searchParams.get('limit') ?? '200', 10),
    500,
  );

  if (!name) {
    return NextResponse.json({ error: 'name param required' }, { status: 400 });
  }

  const supabase = serviceClient();

  const { data, error } = await supabase
    .from('ge_price_history')
    .select('id, item_id, price, sampled_at')
    .ilike('item_name', name)
    .order('sampled_at', { ascending: true })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ prices: data ?? [] });
}
