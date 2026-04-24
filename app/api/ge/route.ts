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

type MostTradedRange = '1D' | '1W' | '1M' | 'ALL';

function rangeStartIso(range: MostTradedRange): string | null {
  const now = Date.now();
  if (range === '1D') return new Date(now - 24 * 60 * 60 * 1000).toISOString();
  if (range === '1W') return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  if (range === '1M') return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  return null;
}

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
  const range = (request.nextUrl.searchParams.get('range') as MostTradedRange) ?? '1D';

  try {
    if (tab === 'overview-summary') {
      const supabase = serviceClient();
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const pageSize = 1000;
      const maxPages = 60;
      const rows: Array<{ item_name: string; total_value: number; source: string; type: string | null }> = [];

      for (let page = 0; page < maxPages; page++) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        const { data, error } = await supabase
          .from('trade_history')
          .select('item_name,total_value,source,type,traded_at')
          .gte('traded_at', since)
          .order('traded_at', { ascending: false })
          .range(from, to);

        if (error) throw new Error(error.message);
        const chunk = data ?? [];
        rows.push(...chunk);
        if (chunk.length < pageSize) break;
      }

      const validRows = rows.filter(
        (r) => r.source === 'transaction' || (r.source === 'offer' && r.type === 'SELL')
      );

      const txGp = validRows.reduce((s, r) => s + (Number(r.total_value) || 0), 0);
      const txCount = validRows.length;
      const uniqueTxItems = new Set(validRows.map((r) => r.item_name).filter(Boolean)).size;

      return NextResponse.json({ txGp, txCount, uniqueTxItems });
    }

    if (tab === 'most-traded') {
      const supabase = serviceClient();
      const since = rangeStartIso(range);
      const pageSize = 1000;

      const volumeByItem: Record<string, number> = {};
      let tradeRows = 0;
      let consideredRows = 0;

      for (let page = 0; ; page++) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        let tradeQuery = supabase
          .from('trade_history')
          .select('item_name,quantity,source,type')
          .in('source', ['transaction', 'offer'])
          .order('traded_at', { ascending: false })
          .range(from, to);
        if (since) tradeQuery = tradeQuery.gte('traded_at', since);

        const { data, error } = await tradeQuery;
        if (error) throw new Error(error.message);
        const rows = data ?? [];
        if (rows.length === 0) break;

        tradeRows += rows.length;

        for (const row of rows) {
          const isTradeLike = row.source === 'transaction' || (row.source === 'offer' && row.type === 'SELL');
          if (!isTradeLike) continue;
          consideredRows += 1;

          if (!row.item_name) continue;
          const qty = Number(row.quantity) || 0;
          if (qty <= 0) continue;
          volumeByItem[row.item_name] = (volumeByItem[row.item_name] || 0) + qty;
        }

        if (rows.length < pageSize) break;
      }

      const top = Object.entries(volumeByItem)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, quantity]) => ({ name, quantity }));

      return NextResponse.json({
        range,
        top,
        sourceCounts: {
          scannedRows: tradeRows,
          consideredRows,
        },
      });
    }

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
