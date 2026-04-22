'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// ── Types ─────────────────────────────────────────────────────────────────

interface Transaction {
  id: number;
  datetime: string;
  item: number;
  name: string;
  quantity: number;
  cost: string; // total cost
}

interface Offer {
  id: number;
  datetime: string;
  item: number;
  name: string;
  quantity: number;
  cost: number; // price each
  type: 'BUY' | 'SELL';
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatGp(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)         return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return 'just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

const TABS = ['Transactions', 'Offers'] as const;
type Tab = typeof TABS[number];

// ── Component ─────────────────────────────────────────────────────────────

export default function GEClient() {
  const router = useRouter();
  const [tab, setTab]               = useState<Tab>('Transactions');
  const [transactions, setTx]       = useState<Transaction[]>([]);
  const [offers, setOffers]         = useState<Offer[]>([]);
  const [filter, setFilter]         = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [loadedTab, setLoadedTab]   = useState<Tab | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const loading = loadedTab !== tab;

  function openItem(name: string) {
    router.push('/ge/item/' + encodeURIComponent(name));
  }

  const load = useCallback(async (t: Tab) => {
    try {
      const key = t === 'Transactions' ? 'transactions' : 'offers';
      const res = await fetch(`/api/ge?tab=${key}`);
      const data = await res.json();
      if (t === 'Transactions') setTx(data.transactions ?? []);
      else setOffers(data.offers ?? []);
      setLastRefresh(new Date());
    } catch {
      // ignore
    } finally {
      setLoadedTab(t);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const key = tab === 'Transactions' ? 'transactions' : 'offers';
    fetch(`/api/ge?tab=${key}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        if (tab === 'Transactions') setTx(data.transactions ?? []);
        else setOffers(data.offers ?? []);
        setLastRefresh(new Date());
        setLoadedTab(tab);
      })
      .catch(() => setLoadedTab(tab));
    return () => controller.abort();
  }, [tab]);

  // Filtered rows
  const q = filter.toLowerCase();

  const filteredTx = transactions.filter(t =>
    !q || t.name.toLowerCase().includes(q)
  );

  const filteredOffers = offers.filter(o => {
    const nameMatch = !q || o.name.toLowerCase().includes(q);
    const typeMatch = typeFilter === 'ALL' || o.type === typeFilter;
    return nameMatch && typeMatch && o.name !== 'null' && o.name !== 'unknown';
  });

  // Stats banner for transactions
  const txTotalGp    = filteredTx.reduce((s, t) => s + (parseInt(t.cost, 10) || 0), 0);
  const offerBuyGp   = filteredOffers.filter(o => o.type === 'BUY').reduce((s, o) => s + o.cost * o.quantity, 0);
  const offerSellGp  = filteredOffers.filter(o => o.type === 'SELL').reduce((s, o) => s + o.cost * o.quantity, 0);

  return (
    <main className="flex-1 max-w-5xl mx-auto px-4 py-10 w-full animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Grand Exchange</h1>
          <p className="text-slate-400 text-sm mt-0.5">Live trades and open offers on Ferox.ps</p>
        </div>
        <button
          onClick={() => load(tab)}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-sm transition disabled:opacity-50"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>
      {lastRefresh && (
        <p className="text-xs text-slate-600 mb-6">Updated {lastRefresh.toLocaleTimeString()}</p>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-[#1e1c2a] border border-white/[0.07] rounded-xl p-1 mb-4 w-fit">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              tab === t ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Stats row */}
      {!loading && tab === 'Transactions' && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-xl bg-white/[0.04] border border-white/5 px-4 py-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Trades Shown</div>
            <div className="text-lg font-bold text-white">{filteredTx.length.toLocaleString()}</div>
          </div>
          <div className="rounded-xl bg-white/[0.04] border border-white/5 px-4 py-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Total Volume</div>
            <div className="text-lg font-bold text-emerald-400">{formatGp(txTotalGp)}</div>
          </div>
          <div className="rounded-xl bg-white/[0.04] border border-white/5 px-4 py-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Avg per Trade</div>
            <div className="text-lg font-bold text-white">{filteredTx.length > 0 ? formatGp(Math.round(txTotalGp / filteredTx.length)) : '—'}</div>
          </div>
        </div>
      )}
      {!loading && tab === 'Offers' && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-xl bg-white/[0.04] border border-white/5 px-4 py-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Open Offers</div>
            <div className="text-lg font-bold text-white">{filteredOffers.length.toLocaleString()}</div>
          </div>
          <div className="rounded-xl bg-emerald-900/20 border border-emerald-900/30 px-4 py-3">
            <div className="text-[10px] uppercase tracking-widest text-emerald-600 mb-1">Buy Orders</div>
            <div className="text-lg font-bold text-emerald-400">{formatGp(offerBuyGp)}</div>
          </div>
          <div className="rounded-xl bg-amber-900/20 border border-amber-900/30 px-4 py-3">
            <div className="text-[10px] uppercase tracking-widest text-amber-600 mb-1">Sell Listings</div>
            <div className="text-lg font-bold text-amber-400">{formatGp(offerSellGp)}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && filter.trim()) openItem(filter.trim()); }}
            placeholder="Filter or search item..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-600/50"
          />
        </div>
        {tab === 'Offers' && (
          <div className="flex gap-1 bg-white/[0.04] border border-white/[0.07] rounded-lg p-0.5">
            {(['ALL', 'BUY', 'SELL'] as const).map(v => (
              <button
                key={v}
                onClick={() => setTypeFilter(v)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  typeFilter === v
                    ? v === 'BUY'  ? 'bg-emerald-700 text-white'
                    : v === 'SELL' ? 'bg-amber-700 text-white'
                    : 'bg-slate-700 text-white'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-1.5">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="h-11 rounded-xl bg-white/5 animate-pulse" style={{ animationDelay: `${i * 40}ms` }} />
          ))}
        </div>
      ) : tab === 'Transactions' ? (
        <TransactionTable rows={filteredTx} onItemClick={openItem} />
      ) : (
        <OffersTable rows={filteredOffers} onItemClick={openItem} />
      )}

    </main>
  );
}

// ── Sub-tables ─────────────────────────────────────────────────────────────

function TransactionTable({ rows, onItemClick }: { rows: Transaction[]; onItemClick: (name: string) => void }) {
  if (rows.length === 0) return <EmptyState />;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02]">
      <div className="grid grid-cols-[1fr_80px_100px_100px_90px] gap-0 px-4 py-2 border-b border-white/[0.06] text-[10px] uppercase tracking-widest text-slate-500">
        <span>Item</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Each</span>
        <span className="text-right">Total</span>
        <span className="text-right">Time</span>
      </div>
      <div className="max-h-[600px] overflow-y-auto">
        {rows.map((t, i) => {
          const total    = parseInt(t.cost, 10) || 0;
          const priceEa  = t.quantity > 0 ? Math.round(total / t.quantity) : total;
          return (
            <div
              key={t.id}
              role="row"
              tabIndex={0}
              onClick={() => onItemClick(t.name)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onItemClick(t.name); } }}
              className={`grid grid-cols-[1fr_80px_100px_100px_90px] items-center gap-0 px-4 py-2.5 cursor-pointer transition hover:bg-white/[0.05] focus:bg-white/[0.05] focus:outline-none focus:ring-1 focus:ring-emerald-500/50 ${
                i < rows.length - 1 ? 'border-b border-white/[0.03]' : ''
              }`}
            >
              <span className="text-sm text-slate-200 truncate pr-2 hover:text-emerald-400 transition-colors">{t.name}</span>
              <span className="text-sm text-right tabular-nums text-slate-400">{t.quantity.toLocaleString()}</span>
              <span className="text-sm text-right tabular-nums text-slate-300">{formatGp(priceEa)}</span>
              <span className="text-sm text-right tabular-nums font-medium text-emerald-400">{formatGp(total)}</span>
              <span className="text-xs text-right text-slate-600">{timeAgo(t.datetime)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OffersTable({ rows, onItemClick }: { rows: Offer[]; onItemClick: (name: string) => void }) {
  if (rows.length === 0) return <EmptyState />;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02]">
      <div className="grid grid-cols-[60px_1fr_80px_100px_100px_90px] gap-0 px-4 py-2 border-b border-white/[0.06] text-[10px] uppercase tracking-widest text-slate-500">
        <span>Type</span>
        <span>Item</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Each</span>
        <span className="text-right">Total</span>
        <span className="text-right">Time</span>
      </div>
      <div className="max-h-[600px] overflow-y-auto">
        {rows.map((o, i) => (
          <div
            key={o.id}
            role="row"
            tabIndex={0}
            onClick={() => onItemClick(o.name)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onItemClick(o.name); } }}
            className={`grid grid-cols-[60px_1fr_80px_100px_100px_90px] items-center gap-0 px-4 py-2.5 cursor-pointer transition hover:bg-white/[0.05] focus:bg-white/[0.05] focus:outline-none focus:ring-1 focus:ring-emerald-500/50 ${
              i < rows.length - 1 ? 'border-b border-white/[0.03]' : ''
            }`}
          >
            <span className={`inline-block text-center text-[10px] font-bold px-1.5 py-0.5 rounded-md w-fit ${
              o.type === 'BUY'
                ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-900/60'
                : 'bg-amber-900/40 text-amber-400 border border-amber-900/60'
            }`}>{o.type}</span>
            <span className="text-sm text-slate-200 truncate px-2 hover:text-emerald-400 transition-colors">{o.name}</span>
            <span className="text-sm text-right tabular-nums text-slate-400">{o.quantity.toLocaleString()}</span>
            <span className="text-sm text-right tabular-nums text-slate-300">{formatGp(o.cost)}</span>
            <span className={`text-sm text-right tabular-nums font-medium ${o.type === 'BUY' ? 'text-emerald-400' : 'text-amber-400'}`}>
              {formatGp(o.cost * o.quantity)}
            </span>
            <span className="text-xs text-right text-slate-600">{timeAgo(o.datetime)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="text-center py-16 text-slate-500">
      <p className="text-lg font-semibold mb-1">No results</p>
      <p className="text-sm">Try clearing your filter.</p>
    </div>
  );
}
