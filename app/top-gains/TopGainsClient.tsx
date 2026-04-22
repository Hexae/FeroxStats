'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatXp } from '@/lib/osrs';

const PERIODS = [
  { key: 'day', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
] as const;

const PERIOD_HOURS: Record<string, number> = {
  day: 24,
  week: 168,
  month: 720,
};

interface GainEntry {
  username: string;
  display_name: string;
  xpGained: number;
  levelsGained: number;
}

export default function TopGainsClient() {
  const [period, setPeriod] = useState<string>('week');
  const [gains, setGains] = useState<GainEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const r = await fetch(`/api/top-gains?period=${period}`);
        const data = await r.json();
        if (!cancelled) setGains(data.gains ?? []);
      } catch {
        if (!cancelled) setGains([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [period]);

  return (
    <main className="flex-1 max-w-4xl mx-auto px-4 py-10 w-full animate-fade-up">
      <h1 className="text-3xl font-extrabold text-white mb-2">Top Gains</h1>
      <p className="text-slate-400 text-sm mb-6">Who gained the most XP? Rankings update as snapshots are collected.</p>

      {/* Period picker */}
      <div className="flex gap-1 bg-[#1e1c2a] border border-white/[0.07] rounded-xl p-1 mb-6 w-fit">
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              period === p.key ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      ) : gains.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <p className="text-lg font-semibold mb-1">No gains recorded</p>
          <p className="text-sm">Not enough snapshots in this period yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03]">
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-0 border-b border-white/5 px-4 py-2.5 text-[10px] uppercase tracking-widest text-slate-500">
            <span className="w-10">#</span>
            <span>Player</span>
            <span className="w-28 text-right">XP Gained</span>
            <span className="w-20 text-right">XP/hr</span>
            <span className="w-16 text-right">Levels</span>
          </div>

          {gains.map((g, i) => (
            <div
              key={g.username}
              className={`grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-0 px-4 py-3 transition hover:bg-white/[0.03] ${
                i === 0 ? 'bg-amber-500/5' : i === 1 ? 'bg-slate-500/5' : i === 2 ? 'bg-orange-500/5' : ''
              } ${i < gains.length - 1 ? 'border-b border-white/[0.03]' : ''}`}
            >
              <span className={`w-10 text-sm font-bold tabular-nums ${
                i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-orange-400' : 'text-slate-600'
              }`}>
                {i + 1}
              </span>
              <Link
                href={`/player/${encodeURIComponent(g.username)}`}
                className="text-sm font-semibold text-slate-200 hover:text-emerald-400 transition-colors truncate"
              >
                {g.display_name}
              </Link>
              <span className="w-28 text-right text-sm tabular-nums font-medium text-emerald-400">
                +{formatXp(g.xpGained)}
              </span>
              <span className="w-20 text-right text-xs tabular-nums text-slate-500">
                {formatXp(Math.round(g.xpGained / (PERIOD_HOURS[period] || 168)))}/hr
              </span>
              <span className={`w-16 text-right text-sm tabular-nums ${
                g.levelsGained > 0 ? 'text-amber-400 font-semibold' : 'text-slate-600'
              }`}>
                {g.levelsGained > 0 ? `+${g.levelsGained}` : '0'}
              </span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
