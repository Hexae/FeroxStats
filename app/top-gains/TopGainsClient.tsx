'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { formatXp, getGameMode } from '@/lib/osrs';
import GameModeSelect from '@/components/GameModeSelect';

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
  game_mode: string;
  xpGained: number;
  levelsGained: number;
}

export default function TopGainsClient() {
  const [period, setPeriod] = useState<string>('week');
  const [gameModeFilter, setGameModeFilter] = useState<string>('all');
  const [gains, setGains] = useState<GainEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const filteredGains = gains.filter(
    (g) => gameModeFilter === 'all' || g.game_mode === gameModeFilter
  );

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
      <div className="flex flex-wrap gap-2 mb-6 items-center">
        <div className="flex gap-1 bg-[#1e1c2a] border border-white/[0.07] rounded-xl p-1 w-fit">
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
        <GameModeSelect value={gameModeFilter} onChange={setGameModeFilter} includeAll />
      </div>

      {loading ? (
        <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-10">
          <div className="flex flex-col items-center justify-center text-center gap-4">
            <div className="w-10 h-10 rounded-full border-4 border-emerald-600/30 border-t-emerald-500 animate-spin" />
            <p className="text-slate-400 text-sm">Loading...</p>
          </div>
        </div>
      ) : filteredGains.length === 0 ? (
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

          {filteredGains.map((g, i) => (
            <div
              key={g.username}
              className={`grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-0 px-4 py-3 transition hover:bg-white/[0.03] ${
                i === 0 ? 'bg-amber-500/5' : i === 1 ? 'bg-slate-500/5' : i === 2 ? 'bg-orange-500/5' : ''
              } ${i < filteredGains.length - 1 ? 'border-b border-white/[0.03]' : ''}`}
            >
              <span className={`w-10 text-sm font-bold tabular-nums ${
                i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-orange-400' : 'text-slate-600'
              }`}>
                {i + 1}
              </span>
              <Link
                href={`/player/${encodeURIComponent(g.username)}`}
                className="flex items-center gap-1.5 text-sm font-semibold text-slate-200 hover:text-emerald-400 transition-colors truncate"
              >
                {(() => { const gm = getGameMode(g.game_mode); return gm.emoji ? <Image src={gm.emoji} alt={gm.label} width={14} height={14} className={`shrink-0 opacity-90 ${gm.key === 'realism_group_ironman' ? 'h-4' : 'h-3.5'} w-auto`} /> : null; })()}
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
