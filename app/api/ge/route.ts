import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase-service';

const FEROX_TRANSACTIONS = 'https://ferox.ps/api/tradingpost/transactions';
const FEROX_OFFERS       = 'https://ferox.ps/api/tradingpost/offers';

interface FeroxTransaction {
  id: number;
  datetime: string;
  item: number;
  name: string;
  quantity: number;
  cost: string; // total cost as string
}

interface FeroxOffer {
  id: number;
  datetime: string;
  item: number;
  name: string;
  quantity: number;
  cost: number; // per-item price as number
  type: 'BUY' | 'SELL';
}

type TradeHistoryInsert = {
  id: number;
  source: string;
  item_id: number;
  item_name: string;
  quantity: number;
  price_each: number;
  total_value: number;
  type?: string | null;
  traded_at: string;
};

async function upsertToDb(rows: TradeHistoryInsert[]) {
  if (rows.length === 0) return;
  const supabase = serviceClient();
  const { error } = await supabase
    .from('trade_history')
    .upsert(rows, { onConflict: 'id,source', ignoreDuplicates: true });
  if (error) {
    // Upsert failure is non-fatal; live data is still returned to the caller
  }
}

// GET /api/ge?tab=transactions|offers
export async function GET(request: NextRequest) {
  const tab = request.nextUrl.searchParams.get('tab') ?? 'transactions';

  try {
    if (tab === 'offers') {
      const res = await fetch(FEROX_OFFERS, { next: { revalidate: 60 }, signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`Ferox API ${res.status}`);
      const raw: FeroxOffer[] = await res.json();

      // Persist to DB asynchronously (don't block response)
      upsertToDb(
        raw
          .filter(o => o.name && o.name !== 'null' && o.name !== 'unknown')
          .map(o => ({
            id:          o.id,
            source:      'offer',
            item_id:     o.item,
            item_name:   o.name,
            quantity:    o.quantity,
            price_each:  o.cost,
            total_value: o.cost * o.quantity,
            type:        o.type,
            traded_at:   o.datetime,
          }))
      );

      return NextResponse.json({ offers: raw });
    } else {
      const res = await fetch(FEROX_TRANSACTIONS, { next: { revalidate: 60 }, signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`Ferox API ${res.status}`);
      const raw: FeroxTransaction[] = await res.json();

      // Persist to DB asynchronously
      upsertToDb(
        raw
          .filter(t => t.name && t.name !== 'null' && t.name !== 'unknown')
          .map(t => {
            const totalValue  = parseInt(t.cost, 10) || 0;
            const priceEach   = t.quantity > 0 ? Math.round(totalValue / t.quantity) : totalValue;
            return {
              id:          t.id,
              source:      'transaction',
              item_id:     t.item,
              item_name:   t.name,
              quantity:    t.quantity,
              price_each:  priceEach,
              total_value: totalValue,
              type:        null,
              traded_at:   t.datetime,
            };
          })
      );

      return NextResponse.json({ transactions: raw });
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
