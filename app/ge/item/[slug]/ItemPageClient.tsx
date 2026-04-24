'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  Tooltip,
  Filler,
  CategoryScale,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(LineElement, PointElement, LinearScale, Tooltip, Filler, CategoryScale);

// ── Types ─────────────────────────────────────────────────────────────────

interface HistoryRow {
  id: number;
  source: 'transaction' | 'offer';
  quantity: number;
  price_each: number;
  total_value: number;
  type: 'BUY' | 'SELL' | 'TRANSACTION' | null;
  traded_at: string;
}

interface PriceHistoryRow {
  id: number;
  item_id: number;
  price: number;
  sampled_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatGp(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)         return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

function timeAgo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return 'just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── Range helpers ─────────────────────────────────────────────────────────

const RANGES = ['1W', '1M', '3M', 'All'] as const;
type Range = typeof RANGES[number];

function rangeStart(r: Range): Date | null {
  const now = new Date();
  if (r === '1W')  return new Date(now.getTime() - 7  * 86_400_000);
  if (r === '1M')  return new Date(now.getTime() - 30 * 86_400_000);
  if (r === '3M')  return new Date(now.getTime() - 90 * 86_400_000);
  return null;
}

// ── Main component ────────────────────────────────────────────────────────

export default function ItemPageClient({ name }: { name: string }) {
  const router = useRouter();

  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [range,   setRange]   = useState<Range>('All');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [tradeRes, priceRes] = await Promise.all([
          fetch(`/api/ge/item?name=${encodeURIComponent(name)}&limit=500`),
          fetch(`/api/ge/item/price-history?name=${encodeURIComponent(name)}&limit=500`),
        ]);
        const [tradeData, priceData] = await Promise.all([tradeRes.json(), priceRes.json()]);
        if (!cancelled) {
          setHistory(tradeData.history ?? []);
          setPriceHistory(priceData.prices ?? []);
        }
      } catch {
        if (!cancelled) { setHistory([]); setPriceHistory([]); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [name]);

  // Filter by time range
  const start    = rangeStart(range);
  const filtered = start
    ? history.filter(h => new Date(h.traded_at) >= start)
    : history;

  // Tracker price history filtered by the same range
  const filteredPrices = start
    ? priceHistory.filter(p => new Date(p.sampled_at) >= start)
    : priceHistory;

  // Chart data for tracker prices — sampled every 5 min, show as time labels
  const trackerChartLabels = filteredPrices.map(p =>
    new Date(p.sampled_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  );
  const trackerChartPrices = filteredPrices.map(p => p.price);

  const trackerChartData = {
    labels: trackerChartLabels,
    datasets: [
      {
        label: 'Median offer price (gp)',
        data: trackerChartPrices,
        borderColor: '#818cf8',
        backgroundColor: 'rgba(129,140,248,0.08)',
        fill: true,
        tension: 0.3,
        pointRadius: trackerChartLabels.length > 60 ? 0 : 2,
        pointHoverRadius: 5,
        borderWidth: 2,
      },
    ],
  };

  // Stats
  const prices   = filtered.map(h => h.price_each).filter(p => p > 0);
  const avgPrice = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 0;
  const totalVol = filtered.reduce((s, h) => s + h.total_value, 0);
  const totalQty = filtered.reduce((s, h) => s + h.quantity, 0);
  const buyVol   = filtered.filter(h => h.type === 'BUY').reduce((s, h)  => s + h.quantity, 0);
  const sellVol  = filtered.filter(h => h.type === 'SELL').reduce((s, h) => s + h.quantity, 0);

  // Chart — chronological order, deduplicated by date (take avg price per date bucket)
  const chronological = [...filtered].reverse();

  // Group by date for cleaner chart when there are lots of points
  const bucketMap = new Map<string, { sum: number; count: number }>();
  for (const h of chronological) {
    const key = fmtDate(h.traded_at);
    const cur = bucketMap.get(key) ?? { sum: 0, count: 0 };
    bucketMap.set(key, { sum: cur.sum + h.price_each, count: cur.count + 1 });
  }
  const buckets    = Array.from(bucketMap.entries());
  const chartLabels = buckets.map(([k]) => k);
  const chartPrices = buckets.map(([, v]) => Math.round(v.sum / v.count));

  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        label: 'Avg price each (gp)',
        data: chartPrices,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16,185,129,0.08)',
        fill: true,
        tension: 0.3,
        pointRadius: chartLabels.length > 40 ? 0 : 3,
        pointHoverRadius: 5,
        borderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { parsed: { y: number } }) => ` ${formatGp(ctx.parsed.y)} gp`,
        },
      },
    },
    scales: {
      x: {
        ticks: { color: '#64748b', maxTicksLimit: 8, font: { size: 11 } },
        grid:  { color: 'rgba(255,255,255,0.04)' },
      },
      y: {
        ticks: {
          color: '#64748b',
          font:  { size: 11 },
          callback: (v: string | number) =>
            formatGp(typeof v === 'number' ? v : parseFloat(v)),
        },
        grid: { color: 'rgba(255,255,255,0.04)' },
      },
    },
  };

  return (
    <main className="flex-1 max-w-4xl mx-auto px-4 py-10 w-full animate-fade-up">

      {/* Back nav */}
      <button
        onClick={() => router.push('/ge')}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition mb-6 group"
      >
        <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
        </svg>
        Grand Exchange
      </button>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-white">{name}</h1>
        {!loading && (
          <p className="text-slate-400 text-sm mt-1">
            {filtered.length.toLocaleString()} records
            {' · '}
            {totalQty.toLocaleString()} items traded
          </p>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
          <div className="h-64 rounded-2xl bg-white/5 animate-pulse" />
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-10 rounded-xl bg-white/5 animate-pulse" style={{ animationDelay: `${i * 40}ms` }} />
            ))}
          </div>
        </div>
      ) : history.length === 0 ? (
        <div className="py-20 text-center text-slate-500 rounded-2xl bg-white/[0.02] border border-white/5">
          <p className="text-lg font-semibold text-slate-300 mb-2">No records found</p>
          <p className="text-sm">No trade history for &ldquo;{name}&rdquo; yet. Data is collected automatically.</p>
        </div>
      ) : (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Avg Price',    value: formatGp(avgPrice),  color: 'text-emerald-400' },
              { label: 'Lowest',       value: formatGp(minPrice),  color: 'text-sky-400'     },
              { label: 'Highest',      value: formatGp(maxPrice),  color: 'text-amber-400'   },
              { label: 'Total Volume', value: formatGp(totalVol),  color: 'text-white'       },
            ].map(s => (
              <div key={s.label} className="rounded-xl bg-white/[0.04] border border-white/[0.07] px-4 py-3">
                <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">{s.label}</div>
                <div className={`text-lg font-bold tabular-nums ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Buy / Sell volume row (only when we have typed data) */}
          {(buyVol > 0 || sellVol > 0) && (
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="rounded-xl bg-emerald-900/20 border border-emerald-900/30 px-4 py-3">
                <div className="text-[10px] uppercase tracking-widest text-emerald-600 mb-1">Buy Volume</div>
                <div className="text-base font-bold text-emerald-400 tabular-nums">{buyVol.toLocaleString()} items</div>
              </div>
              <div className="rounded-xl bg-amber-900/20 border border-amber-900/30 px-4 py-3">
                <div className="text-[10px] uppercase tracking-widest text-amber-600 mb-1">Sell Volume</div>
                <div className="text-base font-bold text-amber-400 tabular-nums">{sellVol.toLocaleString()} items</div>
              </div>
            </div>
          )}

          {/* Tracker sampled price chart */}
          {filteredPrices.length >= 2 && (
            <div className="rounded-2xl bg-white/[0.02] border border-white/[0.07] p-4 mb-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-xs uppercase tracking-widest text-slate-500">Tracker Price History</span>
                  <p className="text-[10px] text-slate-600 mt-0.5">Median offer price sampled every ~5 min</p>
                </div>
                <span className="text-[10px] text-indigo-400 border border-indigo-500/20 bg-indigo-500/10 rounded-full px-2 py-0.5 font-medium">
                  {filteredPrices.length.toLocaleString()} samples
                </span>
              </div>
              <div className="h-52">
                <Line data={trackerChartData} options={chartOptions as Parameters<typeof Line>[0]['options']} />
              </div>
              {filteredPrices.length >= 2 && (() => {
                const first = filteredPrices[0].price;
                const last  = filteredPrices[filteredPrices.length - 1].price;
                const delta = last - first;
                const pct   = first > 0 ? ((delta / first) * 100).toFixed(1) : null;
                return (
                  <div className="mt-2 flex gap-3 text-[11px] text-slate-500">
                    <span>Open: <span className="text-slate-300 font-medium">{formatGp(first)}</span></span>
                    <span>Current: <span className="text-slate-300 font-medium">{formatGp(last)}</span></span>
                    {pct !== null && (
                      <span className={delta >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {delta >= 0 ? '+' : ''}{pct}%
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Range selector + chart */}
          <div className="rounded-2xl bg-white/[0.02] border border-white/[0.07] p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-widest text-slate-500">Price History</span>
              <div className="flex gap-1 bg-white/[0.04] border border-white/[0.07] rounded-lg p-0.5">
                {RANGES.map(r => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                      range === r
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            {chartLabels.length >= 2 ? (
              <div className="h-64">
                <Line data={chartData} options={chartOptions as Parameters<typeof Line>[0]['options']} />
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-600 text-sm">
                Not enough data for this time range
              </div>
            )}
          </div>

          {/* Recent trades */}
          <div>
            <h2 className="text-xs uppercase tracking-widest text-slate-500 mb-3">Recent Trades</h2>
            <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]">
              <div className="grid grid-cols-[56px_80px_110px_110px_90px] gap-0 px-4 py-2 border-b border-white/[0.06] text-[10px] uppercase tracking-widest text-slate-600">
                <span>Type</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Price Each</span>
                <span className="text-right">Total</span>
                <span className="text-right">Time</span>
              </div>
              <div className="divide-y divide-white/[0.03]">
                {filtered.slice(0, 50).map(h => (
                  <div
                    key={`${h.source}-${h.id}`}
                    className="grid grid-cols-[56px_80px_110px_110px_90px] items-center gap-0 px-4 py-2.5"
                  >
                    <span className={`text-[10px] font-bold uppercase ${
                      h.type === 'BUY'         ? 'text-emerald-400'
                      : h.type === 'SELL'      ? 'text-amber-400'
                      : h.type === 'TRANSACTION' ? 'text-sky-400'
                      : 'text-slate-500'
                    }`}>
                      {h.type ?? h.source}
                    </span>
                    <span className="text-sm text-right tabular-nums text-slate-400">{h.quantity.toLocaleString()}</span>
                    <span className="text-sm text-right tabular-nums text-slate-300">{formatGp(h.price_each)}</span>
                    <span className={`text-sm text-right tabular-nums font-medium ${
                      h.type === 'BUY'  ? 'text-emerald-400'
                      : h.type === 'SELL' ? 'text-amber-400'
                      : 'text-slate-300'
                    }`}>{formatGp(h.total_value)}</span>
                    <span className="text-xs text-right text-slate-600">{timeAgo(h.traded_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
