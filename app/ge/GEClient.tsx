'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Transaction {
  id: number;
  datetime: string;
  item: number;
  name: string;
  quantity: number;
  cost: string; // total cost as string
}

interface Offer {
  id: number;
  datetime: string;
  item: number;
  name: string;
  quantity: number;
  cost: number; // per-unit price
  type: 'BUY' | 'SELL';
}

type Tab = 'prices' | 'overview' | 'trades' | 'offers';
type VolumeRange = '1D' | '1W' | '1M' | 'ALL';

export interface AggregatedItem {
  name: string;
  buyPrice: number;
  buyTime: string;
  sellPrice: number;
  sellTime: string;
  lastTrade: number;
  lastTradeTime: string;
  margin: number;
  volume: number;
  gpVolume: number;
  change24h: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatGp(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '0';
  const a = Math.abs(n);
  if (a >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Item icon ─────────────────────────────────────────────────────────────────

function ItemIcon({ name, size = 24 }: { name: string; size?: number }) {
  const [err, setErr] = useState(false);
  const src = `/items/${(name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()).replace(/\s+/g, '_')}.png`;
  if (!name || err) {
    return (
      <div
        className="bg-white/[0.05] rounded flex items-center justify-center font-bold text-amber-400/60 flex-shrink-0"
        style={{ width: size, height: size, fontSize: Math.max(size * 0.42, 9) }}
      >
        {name ? name.charAt(0).toUpperCase() : '?'}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      className="object-contain flex-shrink-0"
      onError={() => setErr(true)}
      loading="lazy"
    />
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-white/[0.04] ${className ?? ''}`} />;
}

// ── Icons ───────────────────────────────────────────────────────────────────────

const Icons = {
  Prices: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>,
  Overview: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
  Trades: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
  Offers: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  Refresh: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
  GreenArrow: <svg className="w-3 h-3 text-emerald-500 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg>,
  RedArrow: <svg className="w-3 h-3 text-rose-500 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>,
};

// ── Tab button ────────────────────────────────────────────────────────────────

function TabBtn({
  active,
  onClick,
  children,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 text-sm font-semibold flex items-center gap-2 transition-all border-b-2 relative ${
        active
          ? 'text-amber-400 border-amber-500'
          : 'text-neutral-500 border-transparent hover:text-neutral-300 hover:border-neutral-600'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ label }: { label: string }) {
  return (
    <div className="bg-[#0e0e12] border border-white/[0.06] rounded-xl py-20 flex flex-col items-center gap-3 text-neutral-600">
      <svg className="w-12 h-12 opacity-25" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

// ── Prices table ──────────────────────────────────────────────────────────────

type SortField = 'name' | 'buyPrice' | 'sellPrice' | 'lastTrade' | 'change24h' | 'margin' | 'volume' | 'gpVolume';

function PricesTable({
  rows,
  onItemClick,
}: {
  rows: AggregatedItem[];
  onItemClick: (name: string) => void;
}) {
  const [sortField, setSortField] = useState<SortField>('gpVolume');
  const [sortDesc, setSortDesc] = useState(true);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      if (aVal === null) aVal = 0;
      if (bVal === null) bVal = 0;

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDesc ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      }

      if (aVal < bVal) return sortDesc ? 1 : -1;
      if (aVal > bVal) return sortDesc ? -1 : 1;
      return 0;
    });
  }, [rows, sortField, sortDesc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDesc(!sortDesc);
    } else {
      setSortField(field);
      setSortDesc(field !== 'name');
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <span className="inline-block w-3 ml-1 opacity-0 group-hover:opacity-30 transition-opacity">↕</span>;
    return <span className="inline-block w-3 ml-1 text-amber-500">{sortDesc ? '↓' : '↑'}</span>;
  };

  if (rows.length === 0) return <EmptyState label="No items found" />;

  return (
    <div className="bg-[#0e0e12] border border-white/[0.06] rounded-xl overflow-hidden mt-4">
      <div className="overflow-x-auto">
        <div className="max-h-[640px] overflow-y-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="sticky top-0 z-10 bg-[#0e0e12] shadow-sm shadow-black select-none">
              <tr className="border-b border-white/[0.06] text-[10px] font-bold uppercase text-neutral-600 tracking-wider">
                <th className="text-left px-5 py-4 w-12">#</th>
                <th className="text-left px-4 py-4 w-64 cursor-pointer hover:bg-white/[0.02] group transition-colors" onClick={() => handleSort('name')}>
                  Item {renderSortIcon('name')}
                </th>
                <th className="text-right px-4 py-4 cursor-pointer hover:bg-white/[0.02] group transition-colors" onClick={() => handleSort('buyPrice')}>
                  Buy Price {renderSortIcon('buyPrice')}
                </th>
                <th className="text-right px-4 py-4 cursor-pointer hover:bg-white/[0.02] group transition-colors" onClick={() => handleSort('sellPrice')}>
                  Sell Price {renderSortIcon('sellPrice')}
                </th>
                <th className="text-right px-4 py-4 cursor-pointer hover:bg-white/[0.02] group transition-colors" onClick={() => handleSort('lastTrade')}>
                  Last Trade {renderSortIcon('lastTrade')}
                </th>
                <th className="text-right px-4 py-4 cursor-pointer hover:bg-white/[0.02] group transition-colors" onClick={() => handleSort('change24h')}>
                  24H {renderSortIcon('change24h')}
                </th>
                <th className="text-right px-4 py-4 cursor-pointer hover:bg-white/[0.02] group transition-colors" onClick={() => handleSort('margin')}>
                  Margin {renderSortIcon('margin')}
                </th>
                <th className="text-right px-4 py-4 cursor-pointer hover:bg-white/[0.02] group transition-colors" onClick={() => handleSort('volume')}>
                  Volume {renderSortIcon('volume')}
                </th>
                <th className="text-right px-5 py-4 cursor-pointer hover:bg-white/[0.02] group transition-colors text-amber-500/70" onClick={() => handleSort('gpVolume')}>
                  <div className="flex items-center justify-end gap-1">GP Vol {renderSortIcon('gpVolume')}</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {sortedRows.slice(0, 200).map((row, i) => (
                <tr
                  key={row.name}
                  onClick={() => onItemClick(row.name)}
                  className="hover:bg-white/[0.025] cursor-pointer transition-colors group"
                >
                  <td className="px-5 py-3 text-neutral-600 font-mono text-xs">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <ItemIcon name={row.name} size={28} />
                      <span className="font-semibold text-neutral-200 group-hover:text-amber-300 transition-colors truncate max-w-[200px]">
                        {row.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-bold text-neutral-200 tabular-nums">
                      {row.buyPrice ? formatGp(row.buyPrice) : '—'}
                    </div>
                    {row.buyTime && (
                      <div className="text-[10px] text-neutral-500 font-medium">{timeAgo(row.buyTime)}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-bold text-neutral-200 tabular-nums">
                      {row.sellPrice ? formatGp(row.sellPrice) : '—'}
                    </div>
                    {row.sellTime && (
                      <div className="text-[10px] text-neutral-500 font-medium">{timeAgo(row.sellTime)}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-bold text-neutral-300 tabular-nums">
                      {row.lastTrade ? formatGp(row.lastTrade) : '—'}
                    </div>
                    {row.lastTradeTime && (
                      <div className="text-[10px] text-neutral-500 font-medium">{timeAgo(row.lastTradeTime)}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-xs tabular-nums">
                    {row.change24h ? (
                      row.change24h > 0 ? (
                        <span className="text-emerald-500">{Icons.GreenArrow} {(row.change24h * 100).toFixed(1)}%</span>
                      ) : row.change24h < 0 ? (
                        <span className="text-rose-500">{Icons.RedArrow} {Math.abs(row.change24h * 100).toFixed(1)}%</span>
                      ) : (
                        <span className="text-neutral-600">—</span>
                      )
                    ) : (
                      <span className="text-neutral-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-teal-400 tabular-nums text-[13px]">
                    {row.margin ? formatGp(row.margin) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-400 tabular-nums font-mono text-xs">
                    {row.volume > 0 ? row.volume.toLocaleString() : '—'}
                  </td>
                  <td className="px-5 py-3 text-right text-neutral-500 tabular-nums font-medium text-[13px]">
                    {row.gpVolume > 0 ? formatGp(row.gpVolume) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Activity table ────────────────────────────────────────────────────────────

function ActivityTable({
  rows,
  onItemClick,
}: {
  rows: Transaction[];
  onItemClick: (name: string) => void;
}) {
  if (rows.length === 0) return <EmptyState label="No transactions found" />;

  return (
    <div className="bg-[#0e0e12] border border-white/[0.06] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <div className="max-h-[640px] overflow-y-auto">
          <table className="w-full text-sm min-w-[540px]">
            <thead className="sticky top-0 z-10 bg-[#0e0e12]">
              <tr className="border-b border-white/[0.06] text-[10px] font-semibold uppercase text-neutral-600 tracking-wider">
                <th className="text-left px-4 py-3.5">Item</th>
                <th className="text-right px-4 py-3.5">Unit Price</th>
                <th className="text-right px-4 py-3.5">Qty</th>
                <th className="text-right px-4 py-3.5">Total</th>
                <th className="text-right px-4 py-3.5">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {rows.slice(0, 200).map((tx) => {
                const total = parseInt(tx.cost, 10) || 0;
                const unitPrice = tx.quantity > 0 ? Math.round(total / tx.quantity) : total;
                return (
                  <tr
                    key={tx.id}
                    onClick={() => onItemClick(tx.name)}
                    className="hover:bg-white/[0.025] cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <ItemIcon name={tx.name} size={24} />
                        <span className="font-medium text-neutral-300 group-hover:text-amber-300 transition-colors truncate max-w-[200px]">
                          {tx.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-amber-300 tabular-nums">
                      {formatGp(unitPrice)} GP
                    </td>
                    <td className="px-4 py-2.5 text-right text-neutral-500 tabular-nums font-mono text-xs">
                      {tx.quantity.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right text-neutral-400 tabular-nums">
                      {formatGp(total)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-neutral-600 text-xs whitespace-nowrap">
                      {timeAgo(tx.datetime)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Offers table ──────────────────────────────────────────────────────────────
function OffersTable({
  rows,
  onItemClick,
}: {
  rows: Offer[];
  onItemClick: (name: string) => void;
}) {
  if (rows.length === 0) return <EmptyState label="No offers found" />;

  return (
    <div className="bg-[#0e0e12] border border-white/[0.06] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <div className="max-h-[640px] overflow-y-auto">
          <table className="w-full text-sm min-w-[580px]">
            <thead className="sticky top-0 z-10 bg-[#0e0e12]">
              <tr className="border-b border-white/[0.06] text-[10px] font-semibold uppercase text-neutral-600 tracking-wider">
                <th className="text-left px-4 py-3.5 w-16">Type</th>
                <th className="text-left px-4 py-3.5">Item</th>
                <th className="text-right px-4 py-3.5">Price</th>
                <th className="text-right px-4 py-3.5">Qty</th>
                <th className="text-right px-4 py-3.5">Total</th>
                <th className="text-right px-4 py-3.5">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {rows.slice(0, 200).map((o) => (
                <tr
                  key={o.id}
                  onClick={() => onItemClick(o.name)}
                  className="hover:bg-white/[0.025] cursor-pointer transition-colors group"
                >
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                        o.type === 'BUY'
                          ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20'
                      }`}
                    >
                      {o.type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <ItemIcon name={o.name} size={24} />
                      <span className="font-medium text-neutral-300 group-hover:text-amber-300 transition-colors truncate max-w-[200px]">
                        {o.name}
                      </span>
                    </div>
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-bold tabular-nums ${
                      o.type === 'BUY' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {formatGp(o.cost)} GP
                  </td>
                  <td className="px-4 py-2.5 text-right text-neutral-500 tabular-nums font-mono text-xs">
                    {o.quantity.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right text-neutral-400 tabular-nums">
                    {formatGp(o.cost * o.quantity)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-neutral-600 text-xs whitespace-nowrap">
                    {timeAgo(o.datetime)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── List Card ─────────────────────────────────────────────────────────────────

function ListCard({
  title, items, valueLabel, valType, onItemClick
}: {
  title: string; items: [string, number][]; valueLabel: string; valType: 'qty' | 'gp'; onItemClick: (name: string) => void;
}) {
  return (
    <div className="bg-[#0e0e12] border border-white/[0.06] rounded-xl overflow-hidden flex flex-col shadow-lg shadow-black/50 group/card transition-colors hover:border-amber-500/20">
      <div className="px-5 py-4 bg-gradient-to-r from-white/[0.02] to-transparent border-b border-white/[0.06] flex items-center justify-between">
        <h3 className="text-[13px] font-bold uppercase tracking-widest text-neutral-300 group-hover/card:text-amber-400/80 transition-colors">{title}</h3>
        <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-600">{valueLabel}</span>
      </div>
      <div className="flex-1 overflow-y-auto max-h-[360px]">
        <div className="divide-y divide-white/[0.03]">
          {items.map(([name, val], i) => (
            <div
              key={name}
              onClick={() => onItemClick(name)}
              className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.025] cursor-pointer transition-colors group"
            >
              <div className="text-[11px] font-bold text-neutral-600 w-5 text-right">{i + 1}</div>
              <ItemIcon name={name} size={28} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-neutral-200 group-hover:text-amber-300 truncate transition-colors">
                  {name}
                </div>
              </div>
              <div className={`font-mono tabular-nums text-[13px] font-medium ${valType === 'gp' ? 'text-emerald-400' : 'text-amber-400'}`}>
                {valType === 'gp' ? formatGp(val) : val.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab({
  transactions,
  offers,
  stats,
  referenceTime,
  onItemClick,
}: {
  transactions: Transaction[];
  offers: Offer[];
  stats: {
    txGp: number;
    txCount: number;
    uniqueTxItems: number;
    activeOffers: number;
    activeOffersGp: number;
    buyOrders: number;
    sellOrders: number;
  };
  referenceTime: number;
  onItemClick: (name: string) => void;
}) {
  const [volumeRange, setVolumeRange] = useState<VolumeRange>('1D');
  const [remoteTopVolume, setRemoteTopVolume] = useState<[string, number][]>([]);

  const rangeFilteredTransactions = useMemo(() => {
    if (volumeRange === 'ALL') return transactions;
    const windowMs =
      volumeRange === '1D'
        ? 24 * 60 * 60 * 1000
        : volumeRange === '1W'
          ? 7 * 24 * 60 * 60 * 1000
          : 30 * 24 * 60 * 60 * 1000;

    const cutoff = referenceTime - windowMs;
    return transactions.filter((t) => new Date(t.datetime).getTime() >= cutoff);
  }, [transactions, volumeRange, referenceTime]);

  useEffect(() => {
    let cancelled = false;
    async function loadMostTraded() {
      try {
        const res = await fetch(`/api/ge?tab=most-traded&range=${volumeRange}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const top = Array.isArray(data?.top)
          ? data.top.map((x: { name: string; quantity: number }) => [x.name, x.quantity] as [string, number])
          : [];
        setRemoteTopVolume(top);
      } catch {
        if (!cancelled) setRemoteTopVolume([]);
      }
    }
    void loadMostTraded();
    return () => {
      cancelled = true;
    };
  }, [volumeRange]);

  const fallbackTopVolume = useMemo(() => {
    const vols: Record<string, number> = {};
    for (const t of rangeFilteredTransactions) vols[t.name] = (vols[t.name] || 0) + t.quantity;
    return Object.entries(vols)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [rangeFilteredTransactions]);

  const topVolume = remoteTopVolume.length > 0 ? remoteTopVolume : fallbackTopVolume;

  const mostValuableTrades = useMemo(() => {
    return [...transactions]
      .sort((a, b) => (parseInt(b.cost, 10) || 0) - (parseInt(a.cost, 10) || 0))
      .slice(0, 10);
  }, [transactions]);

  const topDemand = useMemo(() => {
    const vols: Record<string, number> = {};
    for (const o of offers) if (o.type === 'BUY') vols[o.name] = (vols[o.name] || 0) + o.quantity;
    return Object.entries(vols)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [offers]);

  const topSupply = useMemo(() => {
    const vols: Record<string, number> = {};
    for (const o of offers) if (o.type === 'SELL') vols[o.name] = (vols[o.name] || 0) + o.quantity;
    return Object.entries(vols)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [offers]);

  return (
    <div className="flex flex-col gap-6 mt-6">
      {/* Overview Stats Header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-2">
        <div className="bg-[#101015] border border-white/[0.04] p-5 rounded-xl flex flex-col justify-center">
          <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Trade Volume (30d)</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-400 tabular-nums leading-none tracking-tight">{formatGp(stats.txGp)}</span>
          </div>
          <p className="text-xs text-neutral-600 mt-2 font-medium">{stats.txCount.toLocaleString()} trades · {stats.uniqueTxItems} items</p>
        </div>
        <div className="bg-[#101015] border border-white/[0.04] p-5 rounded-xl flex flex-col justify-center">
          <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Active Offers</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white tabular-nums leading-none tracking-tight">{formatGp(stats.activeOffersGp)}</span>
          </div>
          <p className="text-xs text-neutral-600 mt-2 font-medium">{stats.activeOffers} total</p>
        </div>
        <div className="bg-[#101015] border border-white/[0.04] p-5 rounded-xl flex flex-col justify-center">
          <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Buy Orders</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-400 tabular-nums leading-none tracking-tight">{stats.buyOrders}</span>
          </div>
          <p className="text-xs text-neutral-600 mt-2 font-medium">Active</p>
        </div>
        <div className="bg-[#101015] border border-white/[0.04] p-5 rounded-xl flex flex-col justify-center">
          <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Sell Orders</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-rose-500 tabular-nums leading-none tracking-tight">{stats.sellOrders}</span>
          </div>
          <p className="text-xs text-neutral-600 mt-2 font-medium">Active</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-[#0e0e12] border border-white/[0.06] rounded-xl overflow-hidden flex flex-col shadow-lg shadow-black/50 group/card transition-colors hover:border-amber-500/20">
          <div className="px-5 py-4 bg-gradient-to-r from-white/[0.02] to-transparent border-b border-white/[0.06] flex items-center justify-between gap-2">
            <h3 className="text-[13px] font-bold uppercase tracking-widest text-neutral-300 group-hover/card:text-amber-400/80 transition-colors">Most Traded</h3>
            <div className="flex items-center gap-1 bg-black/40 rounded-lg p-1 border border-white/[0.04]">
              {(['1D', '1W', '1M', 'ALL'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setVolumeRange(r)}
                  className={`px-2 py-1 text-[9px] font-bold uppercase tracking-wider rounded-md transition-all ${
                    volumeRange === r
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                      : 'text-neutral-500 hover:text-neutral-300 border border-transparent'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="px-5 py-2 border-b border-white/[0.03] flex items-center justify-end">
            <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-600">Quantity</span>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[360px]">
            <div className="divide-y divide-white/[0.03]">
              {topVolume.map(([name, val], i) => (
                <div
                  key={name}
                  onClick={() => onItemClick(name)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.025] cursor-pointer transition-colors group"
                >
                  <div className="text-[11px] font-bold text-neutral-600 w-5 text-right">{i + 1}</div>
                  <ItemIcon name={name} size={28} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-neutral-200 group-hover:text-amber-300 truncate transition-colors">
                      {name}
                    </div>
                  </div>
                  <div className="font-mono tabular-nums text-[13px] font-medium text-amber-400">
                    {val.toLocaleString()}
                  </div>
                </div>
              ))}
              {topVolume.length === 0 && (
                <div className="px-4 py-10 text-center text-xs text-neutral-600 font-medium">
                  No transactions in this range
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="bg-[#0e0e12] border border-white/[0.06] rounded-xl overflow-hidden flex flex-col shadow-lg shadow-black/50 group/card transition-colors hover:border-amber-500/20">
          <div className="px-5 py-4 bg-gradient-to-r from-white/[0.02] to-transparent border-b border-white/[0.06] flex items-center justify-between">
            <h3 className="text-[13px] font-bold uppercase tracking-widest text-neutral-300 group-hover/card:text-amber-400/80 transition-colors">Top Sales (24h)</h3>
            <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-600">Amount</span>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[360px]">
            <div className="divide-y divide-white/[0.03]">
              {mostValuableTrades.map((t) => (
                <div
                  key={t.id}
                  onClick={() => onItemClick(t.name)}
                  className="flex flex-col gap-1.5 px-4 py-3 hover:bg-white/[0.025] cursor-pointer transition-colors group"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <ItemIcon name={t.name} size={24} />
                      <div className="flex flex-col">
                        <span className="font-semibold text-xs text-neutral-200 group-hover:text-amber-300 truncate max-w-[120px] transition-colors leading-tight">
                          {t.name}
                        </span>
                        <span className="text-[10px] text-neutral-500 font-mono mt-0.5">{t.quantity}x</span>
                      </div>
                    </div>
                    <span className="text-amber-400 font-bold tabular-nums text-xs">
                      {formatGp(parseInt(t.cost, 10) || 0)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <ListCard title="Highest Demand" items={topDemand} valueLabel="Quantity" valType="qty" onItemClick={onItemClick} />
        <ListCard title="Highest Supply" items={topSupply} valueLabel="Quantity" valType="qty" onItemClick={onItemClick} />
      </div>
      
      <div className="text-center text-[10px] font-bold tracking-widest uppercase text-neutral-600 mt-2">
        Data refreshes every 30s • Click any item for details
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

const POLL_MS = 30_000;

export default function GEClient() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');
  const [transactions, setTx] = useState<Transaction[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [search, setSearch] = useState('');
  const [offerFilter, setOfferFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [priceFilter, setPriceFilter] = useState<'ALL' | 'MOVERS' | 'VOLUME'>('ALL');
  const [overviewSummary, setOverviewSummary] = useState<{ txGp: number; txCount: number; uniqueTxItems: number } | null>(null);

  const navigate = (name: string) => router.push('/ge/item/' + encodeURIComponent(name));

  const loadAll = useCallback(async (silent = false, cancelled?: { current: boolean }) => {
    if (!silent) setLoading(true);
    try {
      const [txRes, offRes] = await Promise.all([
        fetch('/api/ge?tab=transactions', { cache: 'no-store' }),
        fetch('/api/ge?tab=offers', { cache: 'no-store' }),
      ]);
      const [txJson, offJson] = await Promise.all([txRes.json(), offRes.json()]);
      if (cancelled?.current) return;
      setTx(txJson.transactions ?? []);
      setOffers(offJson.offers ?? []);
      setLastRefresh(new Date());
    } catch {
      // silent fail — show stale data
    } finally {
      if (!cancelled?.current) setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => { void loadAll(true); }, [loadAll]);

  useEffect(() => {
    let cancelled = false;
    async function loadOverviewSummary() {
      try {
        const res = await fetch('/api/ge?tab=overview-summary', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setOverviewSummary({
            txGp: Number(data?.txGp) || 0,
            txCount: Number(data?.txCount) || 0,
            uniqueTxItems: Number(data?.uniqueTxItems) || 0,
          });
        }
      } catch {
        if (!cancelled) setOverviewSummary(null);
      }
    }
    void loadOverviewSummary();
    const id = setInterval(() => void loadOverviewSummary(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const guard = { current: false };
    async function load() { await loadAll(false, guard); }
    void load();
    const id = setInterval(() => void loadAll(true), POLL_MS);
    return () => { guard.current = true; clearInterval(id); };
  }, [loadAll]);

  // ── Filtered data ──────────────────────────────────────────────────────
  const q = search.trim().toLowerCase();

  const aggregatedItems = useMemo(() => {
    // Add a temp structure for calculating 24h changes
    const map = new Map<string, Omit<AggregatedItem, 'change24h'> & { change24h: number | null; _trades: { price: number; ts: number }[] }>();
    
    // We use lastRefresh time as our "current time" to keep this pure, fallback to zero if loading.
    const cutoff24h = (lastRefresh ? lastRefresh.getTime() : new Date().getTime()) - 24 * 60 * 60 * 1000;

    for (const t of transactions) {
      if (!map.has(t.name)) {
        map.set(t.name, {
          name: t.name,
          buyPrice: 0, buyTime: '', sellPrice: 0, sellTime: '',
          lastTrade: 0, lastTradeTime: '', margin: 0, volume: 0, gpVolume: 0, change24h: null,
          _trades: []
        });
      }
      const st = map.get(t.name)!;
      const cost = parseInt(t.cost, 10) || 0;
      const unitPrice = t.quantity > 0 ? Math.round(cost / t.quantity) : cost;
      st.volume += t.quantity;
      st.gpVolume += cost;
      
      const ts = new Date(t.datetime).getTime();
      st._trades.push({ price: unitPrice, ts });

      if (!st.lastTradeTime || ts > new Date(st.lastTradeTime).getTime()) {
        st.lastTradeTime = t.datetime;
        st.lastTrade = unitPrice;
      }
    }

    for (const o of offers) {
      if (!map.has(o.name)) {
        map.set(o.name, {
          name: o.name,
          buyPrice: 0, buyTime: '', sellPrice: 0, sellTime: '',
          lastTrade: 0, lastTradeTime: '', margin: 0, volume: 0, gpVolume: 0, change24h: null,
          _trades: []
        });
      }
      const st = map.get(o.name)!;
      if (o.type === 'BUY') {
        if (st.buyPrice === 0 || o.cost > st.buyPrice) {
          st.buyPrice = o.cost;
          st.buyTime = o.datetime;
        }
      } else if (o.type === 'SELL') {
        if (st.sellPrice === 0 || o.cost < st.sellPrice) {
          st.sellPrice = o.cost;
          st.sellTime = o.datetime;
        }
      }
    }

    const arr = Array.from(map.values());
    for (const item of arr) {
      if (item.buyPrice > 0 && item.sellPrice > 0) {
        item.margin = item.sellPrice - item.buyPrice;
      }

      if (item._trades && item._trades.length > 0) {
        // Find price closest to 24h ago
        let oldPrice = item._trades[0].price;
        let closestDiff = Infinity;
        
        for (const tr of item._trades) {
          const diff = Math.abs(tr.ts - cutoff24h);
          if (diff < closestDiff) {
            closestDiff = diff;
            oldPrice = tr.price;
          }
        }
        
        if (oldPrice > 0 && item.lastTrade > 0) {
          item.change24h = (item.lastTrade - oldPrice) / oldPrice;
        } else {
          item.change24h = 0;
        }
      }
    }
    
    // Sort and return stripped clean AggregatedItems
    return arr.map(item => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _trades, ...rest } = item;
      return rest as AggregatedItem;
    }).sort((a, b) => b.gpVolume - a.gpVolume);
  }, [transactions, offers, lastRefresh]);

  const filteredPrices = useMemo(
    () => aggregatedItems.filter((i) => {
      if (q && !i.name.toLowerCase().includes(q)) return false;
      if (priceFilter === 'MOVERS' && (!i.change24h || Math.abs(i.change24h) < 0.01)) return false; // Filter static items
      if (priceFilter === 'VOLUME' && i.volume === 0) return false;
      return true;
    }),
    [aggregatedItems, q, priceFilter],
  );

  const filteredTx = useMemo(
    () =>
      transactions
        .filter((t) => !q || t.name.toLowerCase().includes(q))
        .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime()),
    [transactions, q],
  );

  const filteredOffers = useMemo(
    () =>
      offers
        .filter((o) => {
          if (!o.name || o.name === 'null' || o.name === 'unknown') return false;
          if (q && !o.name.toLowerCase().includes(q)) return false;
          if (offerFilter !== 'ALL' && o.type !== offerFilter) return false;
          return true;
        })
        .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime()),
    [offers, q, offerFilter],
  );

  // ── Aggregate stats ────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const txGp = overviewSummary?.txGp ?? transactions.reduce((s, t) => s + (parseInt(t.cost, 10) || 0), 0);
    const txCount = overviewSummary?.txCount ?? transactions.length;
    const uniqueTxItems = overviewSummary?.uniqueTxItems ?? new Set(transactions.map(t => t.name)).size;
    const activeOffers = offers.length;
    const activeOffersGp = offers.reduce((sum, o) => sum + (o.cost * o.quantity), 0);
    const buyOrders = offers.filter(o => o.type === 'BUY').length;
    const sellOrders = offers.filter(o => o.type === 'SELL').length;
    return { txGp, txCount, uniqueTxItems, activeOffers, activeOffersGp, buyOrders, sellOrders };
  }, [transactions, offers, overviewSummary]);

  return (
    <div className="min-h-screen bg-[#0a0a0e] text-neutral-200 pb-24">
      <main className="max-w-[1400px] mx-auto px-4 pt-16 pb-8">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <button onClick={() => router.push('/')} className="text-neutral-500 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              </button>
              <h1 className="text-2xl font-bold flex items-center gap-2.5 text-white tracking-tight">
                GE Tracker
                <span className="text-[10px] font-black uppercase tracking-widest text-[#f59e0b] bg-[#f59e0b]/10 px-2 py-0.5 rounded-sm outline outline-1 outline-[#f59e0b]/30">FEROX</span>
              </h1>
            </div>
            <p className="text-[13px] font-medium text-neutral-500 mt-1 ml-8">Live pricing from the Ferox Trading Post</p>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold uppercase tracking-wider">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
               {lastRefresh ? 'just now' : 'connecting…'}
            </div>
            <button
              onClick={refresh}
              className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-neutral-500 hover:text-white hover:bg-white/[0.07] transition-all flexitems-center"
              title="Refresh"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin text-amber-500' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Main Navigation ────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 border-b border-white/[0.06] mb-6">
          <TabBtn active={tab === 'prices'} onClick={() => setTab('prices')} icon={Icons.Prices}>
            Prices
          </TabBtn>
          <TabBtn active={tab === 'overview'} onClick={() => setTab('overview')} icon={Icons.Overview}>
            Overview
          </TabBtn>
          <TabBtn active={tab === 'trades'} onClick={() => setTab('trades')} icon={Icons.Trades}>
            Trades
            {!loading && <span className="ml-1 text-[10px] text-neutral-500">{transactions.length}</span>}
          </TabBtn>
          <TabBtn active={tab === 'offers'} onClick={() => setTab('offers')} icon={Icons.Offers}>
            Offers
            {!loading && <span className="ml-1 text-[10px] text-neutral-500">{offers.length}</span>}
          </TabBtn>
        </div>

        {/* ── Sub Header Filters (For Prices/Trades/Offers) ──────────────── */}
        {tab !== 'overview' && (
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="relative w-full max-w-xs">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && search.trim()) navigate(search.trim());
                }}
                placeholder="Search items..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#0e0e12] border border-white/[0.07] rounded-xl text-sm font-medium text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all shadow-inner shadow-black/20"
              />
            </div>

            <div className="flex items-center gap-3">
              {tab === 'prices' && (
                <div className="flex items-center gap-1 bg-black/40 rounded-xl p-1 border border-white/[0.04]">
                  {(['ALL', 'MOVERS', 'VOLUME'] as const).map((filterOpt) => (
                    <button
                      key={filterOpt}
                      onClick={() => setPriceFilter(filterOpt)}
                      className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                        priceFilter === filterOpt
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                          : 'bg-white/[0.08] text-white border border-white/10 hover:text-neutral-300'
                      }`}
                    >
                      {filterOpt === 'VOLUME' ? 'Has Volume' : filterOpt}
                    </button>
                  ))}
                </div>
              )}
              {tab === 'offers' && (
                <div className="flex items-center gap-1 bg-black/40 rounded-xl p-1 border border-white/[0.04]">
                  {(['ALL', 'BUY', 'SELL'] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setOfferFilter(v)}
                      className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                        offerFilter === v
                          ? v === 'BUY'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                            : v === 'SELL'
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                            : 'bg-white/[0.08] text-white border border-white/10'
                          : 'text-neutral-600 hover:text-neutral-300 border border-transparent'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              )}
              
              {/* Right Side Stats in Filter Bar */}
              {tab === 'prices' && (
                <div className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-3">
                  <span>{timeAgo(lastRefresh ? lastRefresh.toISOString() : new Date().toISOString())}</span>
                  <span>{filteredPrices.length} items</span>
                  <button onClick={refresh} className="hover:text-amber-400 transition-colors">
                     {Icons.Refresh}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Content ──────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3 mt-4">
            {Array.from({ length: 14 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : tab === 'overview' ? (
          <OverviewTab
            transactions={transactions}
            offers={offers}
            stats={stats}
            referenceTime={lastRefresh ? lastRefresh.getTime() : 0}
            onItemClick={navigate}
          />
        ) : tab === 'prices' ? (
          <PricesTable rows={filteredPrices} onItemClick={navigate} />
        ) : tab === 'trades' ? (
          <ActivityTable rows={filteredTx} onItemClick={navigate} />
        ) : (
          <OffersTable rows={filteredOffers} onItemClick={navigate} />
        )}

      </main>
    </div>
  );
}
