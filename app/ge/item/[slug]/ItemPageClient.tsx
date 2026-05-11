'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  Tooltip,
  Filler,
  CategoryScale
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

function timeAgo(iso: string, referenceTime: number): string {
  const diff  = referenceTime - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return 'just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// ── Range helpers ─────────────────────────────────────────────────────────

const RANGES = ['1W', '1M', '3M', 'All'] as const;
type Range = typeof RANGES[number];

function rangeStart(r: Range, now: number): Date | null {
  if (r === '1W')  return new Date(now - 7  * 86_400_000);
  if (r === '1M')  return new Date(now - 30 * 86_400_000);
  if (r === '3M')  return new Date(now - 90 * 86_400_000);
  return null;
}

// ── Main component ────────────────────────────────────────────────────────

export default function ItemPageClient({ name }: { name: string }) {
  const router = useRouter();

  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>('All');
  const [tab, setTab] = useState<'all' | 'offers' | 'trades'>('all');
  const [lastRefresh, setLastRefresh] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [tradeRes, priceRes] = await Promise.all([
          fetch(`/api/ge/item?name=` + encodeURIComponent(name) + `&limit=10000`),
          fetch(`/api/ge/item/price-history?name=` + encodeURIComponent(name) + `&limit=10000`),
        ]);
        const [tradeData, priceData] = await Promise.all([tradeRes.json(), priceRes.json()]);
        if (!cancelled) {
          setHistory(tradeData.history ?? []);
          setPriceHistory(priceData.prices ?? []);
          setLastRefresh(Date.now());
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

  // Derived state with useMemo to enforce purity
  const { filteredHistory, chartData, chartTrendPct, chartTrendUp, stats, displayRecords } = useMemo(() => {
    const start = rangeStart(range, lastRefresh);
    
    const fh = start ? history.filter(h => new Date(h.traded_at) >= start) : history;
    const fp = start ? priceHistory.filter(p => new Date(p.sampled_at) >= start) : priceHistory;
    // Keep true transactions plus normal offer BUY/SELL rows, but exclude corrupted
    // offer-side TRANSACTION aggregates that explode prices.
    // Completed transactions only – used for stats and chart
    const transactionRows = fh.filter(
      h =>
        h.quantity > 0 &&
        h.total_value > 0 &&
        (h.source === 'transaction' || h.type === 'TRANSACTION')
    );

    // Calculate stats from transactions only
    const validPrices = transactionRows.map(h => Math.round(h.total_value / h.quantity)).filter(p => p > 0);
    const avgPrice = validPrices.length ? Math.round(validPrices.reduce((a, b) => a + b, 0) / validPrices.length) : 0;
    const minPrice = validPrices.length ? Math.min(...validPrices) : 0;
    const maxPrice = validPrices.length ? Math.max(...validPrices) : 0;
    const totalVol = transactionRows.reduce((s, h) => s + h.total_value, 0);
    const totalQty = transactionRows.reduce((s, h) => s + h.quantity, 0);
    const buyVol   = fh.filter(h => h.type === 'BUY').reduce((s, h)  => s + h.quantity, 0);
    const sellVol  = fh.filter(h => h.type === 'SELL').reduce((s, h) => s + h.quantity, 0);

    // Prepare chart data from completed transactions only.
    const labels: string[] = [];
    const prices: number[] = [];

    const bucketMinutes = range === '1W' ? 60 * 4 : range === '1M' ? 60 * 12 : range === '3M' ? 60 * 24 : 60 * 48;
    const bucketMs = bucketMinutes * 60_000;
    const txBuckets = new Map<number, number[]>();

    for (const tx of transactionRows) {
      if (tx.quantity <= 0 || tx.total_value <= 0) continue;
      const tradedAt = new Date(tx.traded_at).getTime();
      if (!Number.isFinite(tradedAt)) continue;
      const bucketTs = Math.floor(tradedAt / bucketMs) * bucketMs;
      const unitPrice = Math.round(tx.total_value / tx.quantity);
      if (unitPrice <= 0) continue;
      const current = txBuckets.get(bucketTs) ?? [];
      current.push(unitPrice);
      txBuckets.set(bucketTs, current);
    }

    const allTimes = Array.from(txBuckets.keys()).sort((a, b) => a - b);
    for (const t of allTimes) {
      const txValues = txBuckets.get(t);
      let pointPrice = 0;

      if (txValues && txValues.length > 0) {
        pointPrice = Math.round(txValues.reduce((s, p) => s + p, 0) / txValues.length);
      }

      if (pointPrice <= 0) continue;
      const d = new Date(t);
      labels.push(
        range === '1W'
          ? `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${d.getHours()}:00`
          : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      );
      prices.push(pointPrice);
    }

    const data = {
      labels,
      datasets: [
        {
          label: 'Price',
          data: prices,
          borderColor: 'rgb(6, 182, 212)',
          backgroundColor: 'rgba(6, 182, 212, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 6,
          yAxisID: 'y',
        }
      ]
    };

    const firstPrice = prices[0] ?? 0;
    const lastPrice = prices[prices.length - 1] ?? 0;
    const chartTrendPct =
      firstPrice > 0 ? Number((((lastPrice - firstPrice) / firstPrice) * 100).toFixed(1)) : null;
    const chartTrendUp = chartTrendPct !== null ? chartTrendPct >= 0 : null;

    // Filter display records for the list
    const records = fh.filter(h => {
      if (tab === 'all') return true;
      if (tab === 'offers') return h.source === 'offer' || h.type === 'BUY' || h.type === 'SELL';
      if (tab === 'trades') return h.source === 'transaction';
      return true;
    });

    return {
      filteredHistory: fh,
      chartData: data,
      chartTrendPct,
      chartTrendUp,
      stats: { avgPrice, minPrice, maxPrice, totalVol, totalQty, buyVol, sellVol },
      displayRecords: records
    };
  }, [history, priceHistory, range, tab, lastRefresh]);

  function getStatCards() {
    return [
      { label: 'Average Price',  value: formatGp(stats.avgPrice), color: 'text-white border-white/5 bg-white/[0.02]', iconColor: 'text-white/40' },
      { label: 'Lowest Price',   value: formatGp(stats.minPrice), color: 'text-sky-300 border-sky-500/10 bg-sky-500/5', iconColor: 'text-sky-500/40' },
      { label: 'Highest Price',  value: formatGp(stats.maxPrice), color: 'text-amber-300 border-amber-500/10 bg-amber-500/5', iconColor: 'text-amber-500/40' },
      { label: 'Traded Volume',  value: stats.totalQty.toLocaleString(),  color: 'text-emerald-300 border-emerald-500/10 bg-emerald-500/5', iconColor: 'text-emerald-500/40' },
    ];
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        titleColor: '#fff',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: function(context: { parsed: { y: number } }) {
            return `${formatGp(context.parsed.y || 0)} gp`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#6b7280', maxTicksLimit: 8 }
      },
      y: {
        display: true,
        position: 'right' as const,
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: {
          color: '#6b7280',
          callback: function(value: string | number) {
            return formatGp(Number(value));
          }
        }
      }
    }
  };

  const imageName = name.replace(/ /g, '_').toLowerCase() + '.png';

  return (
    <main className="flex-1 max-w-5xl mx-auto px-4 py-8 lg:py-12 w-full animate-fade-up">

      {/* Back Nav */}
      <button
        onClick={() => router.push('/ge')}
        className="flex items-center gap-2 text-[13px] font-semibold text-slate-400 hover:text-slate-200 transition-colors mb-8 group"
      >
        <div className="bg-white/5 border border-white/10 group-hover:border-white/20 p-1.5 rounded shadow-sm transition-colors">
          <svg className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </div>
        Grand Exchange
      </button>

      {loading ? (
        <div className="space-y-6">
          <div className="flex animate-pulse gap-6 border-b border-white/5 pb-8">
             <div className="w-20 h-20 bg-white/[0.03] rounded-[18px]" />
             <div className="flex-1 flex flex-col justify-center gap-3">
               <div className="w-48 h-8 rounded-lg bg-white/[0.04]" />
               <div className="w-32 h-5 rounded-lg bg-white/[0.02]" />
             </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-[90px] rounded-2xl bg-white/[0.03]" />
            ))}
          </div>
          <div className="h-[430px] rounded-3xl bg-white/[0.02] border border-white/[0.04] animate-pulse" />
        </div>
      ) : history.length === 0 ? (
        <div className="py-24 text-center rounded-3xl bg-[#0a0a0e]/50 border border-white/[0.04] flex flex-col items-center shadow-lg">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
             <svg className="w-8 h-8 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
             </svg>
          </div>
          <p className="text-xl font-bold text-white mb-2">No Market Data</p>
          <p className="text-sm text-neutral-400 max-w-sm">
            We haven&apos;t tracked any active offers or recent transactions for <span className="text-white">&quot;{name}&quot;</span> yet.
          </p>
        </div>
      ) : (
        <>
          {/* Hero Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-8 border-b border-white/5 pb-8">
            <div className="flex items-center gap-5">
              <div className="w-[84px] h-[84px] sm:w-[96px] sm:h-[96px] bg-gradient-to-b from-white/10 to-transparent p-[1px] rounded-[22px] shadow-2xl">
                <div className="w-full h-full bg-[#0a0a0e] rounded-[21px] flex items-center justify-center p-4 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-transparent opacity-50" />
                  <Image
                    src={`/items/${imageName}`}
                    alt={name}
                    width={56}
                    height={56}
                    className="object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] z-10 scale-[1.3]"
                    unoptimized
                    onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
                    }}
                  />
                </div>
              </div>
              <div className="flex flex-col justify-center">
                <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight drop-shadow-sm mb-2">{name}</h1>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Market Active
                  </span>
                  <span className="text-sm font-medium text-slate-500">
                    {filteredHistory.length.toLocaleString()} Tracked Samples
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Volumes */}
            {(stats.buyVol > 0 || stats.sellVol > 0) && (
              <div className="flex bg-[#0a0a0e] rounded-xl border border-white/[0.06] shadow-inner divide-x divide-white/[0.04]">
                <div className="px-5 py-3 flex-1 min-w-[120px]">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1.5">Demand (Buy)</p>
                  <p className="text-base font-extrabold text-emerald-400 tabular-nums leading-none">
                    {stats.buyVol.toLocaleString()}
                  </p>
                </div>
                <div className="px-5 py-3 flex-1 min-w-[120px]">
                  <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1.5">Supply (Sell)</p>
                  <p className="text-base font-extrabold text-amber-400 tabular-nums leading-none">
                    {stats.sellVol.toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-10">
            {getStatCards().map((s, i) => (
              <div 
                key={s.label} 
                className={`relative overflow-hidden rounded-[20px] px-5 py-4 border backdrop-blur-sm shadow-xl ${s.color}`}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="relative z-10">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2 drop-shadow-sm">{s.label}</p>
                  <p className="text-2xl font-black tabular-nums tracking-tight">{s.value}</p>
                </div>
                <svg className={`absolute -bottom-4 -right-4 w-24 h-24 stroke-current pointer-events-none opacity-20 ${s.iconColor}`} viewBox="0 0 24 24" fill="none">
                  {i === 0 && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />}
                  {i === 1 && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />}
                  {i === 2 && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />}
                  {i === 3 && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />}
                </svg>
              </div>
            ))}
          </div>

          {/* Price Tracking Chart Section */}
          <div className="mb-10 rounded-[24px] bg-[#0a0a0e]/40 border border-white/[0.05] p-5 sm:p-6 shadow-2xl backdrop-blur-md">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-8">
              <div>
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-white">Market Trends</h2>
                    {chartTrendPct !== null && chartTrendUp !== null && (
                      <span className={`text-[12px] font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                        chartTrendUp ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                      }`}>
                        {chartTrendUp ? '↑' : '↓'} {Math.abs(chartTrendPct)}%
                      </span>
                    )}
                </div>
                <p className="text-sm text-neutral-500 mt-1.5 font-medium">Aggregated pricing matched with periodic traded volume.</p>
              </div>
              <div className="flex p-1 bg-white/[0.03] border border-white/[0.06] rounded-xl shadow-inner self-start">
                {RANGES.map(r => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-wider rounded-lg transition-all ${
                      range === r
                        ? 'bg-emerald-500 text-[#0a0a0e] shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                        : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="-mx-2 sm:-mx-0 rounded-xl p-2 h-[340px]">
               <Line data={chartData} options={chartOptions as React.ComponentProps<typeof Line>['options']} />
            </div>
          </div>

          {/* List & Tabs Section */}
          <div className="pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div className="flex bg-white/[0.03] p-1 rounded-xl border border-white/[0.05] shadow-inner self-start">
                {(['all', 'offers', 'trades'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-5 py-2 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                      tab === t
                        ? 'bg-[#18181f] text-white shadow-[0_4px_12px_rgba(0,0,0,0.5)] border border-white/[0.08]'
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    {t === 'all' ? 'All Activity' : t === 'offers' ? 'Active Offers' : 'Transactions'}
                  </button>
                ))}
              </div>
              <div className="text-xs font-semibold text-neutral-500 bg-white/[0.02] px-3 py-1.5 rounded-lg border border-white/[0.04]">
                Showing {displayRecords.slice(0, 50).length} of {displayRecords.length} records
              </div>
            </div>

            <div className="rounded-[20px] bg-[#0a0a0e]/40 border border-white/[0.05] overflow-hidden shadow-2xl backdrop-blur-sm">
              <div className="grid grid-cols-[90px_1fr_1fr_1fr_100px] gap-0 px-6 py-3.5 border-b border-white/[0.06] bg-white/[0.02] text-[10px] font-extrabold uppercase tracking-widest text-slate-500 shadow-sm">
                <span>Type</span>
                <span className="text-right">Quantity</span>
                <span className="text-right">Price Each</span>
                <span className="text-right">Total Value</span>
                <span className="text-right">Observed</span>
              </div>
              <div className="divide-y divide-white/[0.03] flex flex-col">
                {displayRecords.slice(0, 50).map(h => (
                  <div
                    key={`${h.source}-${h.id}`}
                    className="grid grid-cols-[90px_1fr_1fr_1fr_100px] items-center gap-0 px-6 py-3.5 hover:bg-white/[0.04] transition-colors group cursor-default"
                  >
                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded inline-flex self-start justify-center w-[75px] tracking-wider shadow-sm border ${
                      h.type === 'BUY'           ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                      : h.type === 'SELL'        ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                      : h.type === 'TRANSACTION' ? 'text-sky-400 bg-sky-500/10 border-sky-500/20'
                      : 'text-slate-400 bg-slate-500/10 border-slate-500/20'
                    }`}>
                      {h.type ?? h.source}
                    </span>
                    <span className="text-[13px] font-bold tabular-nums text-slate-300 text-right group-hover:text-white transition-colors">{h.quantity.toLocaleString()}</span>
                    <span className="text-[13px] font-semibold tabular-nums text-slate-200 text-right flex flex-col items-end group-hover:text-white transition-colors">
                        {formatGp(h.price_each)}
                        <span className="text-[10px] text-slate-500 font-medium group-hover:text-slate-400 transition-colors">each</span>
                    </span>
                    <span className={`text-[13px] font-extrabold tabular-nums text-right drop-shadow-sm flex flex-col items-end ${
                      h.type === 'BUY'  ? 'text-emerald-400'
                      : h.type === 'SELL' ? 'text-amber-400'
                      : 'text-slate-100 group-hover:text-white'
                    }`}>
                      {formatGp(h.total_value)}
                      {h.type === 'TRANSACTION' && (
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-medium text-slate-600">traded</span>
                      )}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 text-right flex flex-col items-end">
                        {timeAgo(h.traded_at, lastRefresh)}
                        <span className="text-[9px] font-medium text-slate-600 block opacity-0 group-hover:opacity-100 transition-opacity">
                            {new Date(h.traded_at).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })}
                        </span>
                    </span>
                  </div>
                ))}
                {displayRecords.length === 0 && (
                  <div className="py-16 text-center shadow-inner rounded-b-[20px]">
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3 mx-auto">
                        <svg className="w-5 h-5 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                    </div>
                    <span className="text-sm font-bold text-neutral-400 block mb-1">No Activity Found</span>
                    <span className="text-xs font-medium text-neutral-600 block max-w-[200px] mx-auto leading-relaxed">
                        No {tab === 'all' ? 'events' : tab} matching your current criteria were recorded in this timespan.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
