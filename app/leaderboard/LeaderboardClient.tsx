'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { SKILLS, getSkillIcon, formatXp, getGameMode } from '@/lib/osrs';
import GameModeSelect from '@/components/GameModeSelect';

interface HiscoreEntry {
  rank: number;
  username: string;
  name: string;
  level: number;
  xp: number;
  game_mode?: string;
}

const MEDALS = ['text-amber-400', 'text-slate-300', 'text-orange-400'];
const MEDAL_BG = ['bg-amber-500/5', 'bg-slate-500/5', 'bg-orange-500/5'];

export default function LeaderboardClient() {
  const [skill, setSkill] = useState('overall');
  const [gameModeFilter, setGameModeFilter] = useState('all');
  const [entries, setEntries] = useState<HiscoreEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const selectedSkill = SKILLS.find(s => s.name.toLowerCase() === skill) ?? SKILLS[0];

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const r = await fetch(`/api/hiscores?skill=${encodeURIComponent(skill)}&limit=50`);
        const data = await r.json();
        if (!cancelled) setEntries(data.hiscores ?? []);
      } catch {
        if (!cancelled) setEntries([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [skill]);

  // Client-side game mode filter + re-rank
  const filtered = entries.filter(e =>
    gameModeFilter === 'all' || (e.game_mode ?? 'regular') === gameModeFilter
  );

  return (
    <main className="flex-1 max-w-5xl mx-auto px-4 py-10 w-full animate-fade-up">
      <h1 className="text-3xl font-extrabold text-white mb-1">Leaderboards</h1>
      <p className="text-slate-400 text-sm mb-8">Top players ranked by skill level and XP.</p>

      {/* Skill picker grid */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3 mb-6">
        <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-1">
          {SKILLS.map(s => {
            const isActive = s.name.toLowerCase() === skill;
            return (
              <button
                key={s.id}
                onClick={() => setSkill(s.name.toLowerCase())}
                title={s.name}
                className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 transition-all ${
                  isActive
                    ? 'bg-emerald-600/20 ring-1 ring-emerald-500/40 text-emerald-300'
                    : 'hover:bg-white/[0.05] text-slate-400 hover:text-slate-200'
                }`}
              >
                <Image
                  src={getSkillIcon(s.icon)}
                  alt={s.name}
                  width={24}
                  height={24}
                  className="w-6 h-6 object-contain"
                  unoptimized
                />
                <span className="text-[9px] font-medium leading-none truncate w-full text-center hidden sm:block">
                  {s.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Header row: selected skill + game mode filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <Image
            src={getSkillIcon(selectedSkill.icon)}
            alt={selectedSkill.name}
            width={28}
            height={28}
            className="w-7 h-7 object-contain"
            unoptimized
          />
          <span className="text-lg font-bold text-white">{selectedSkill.name}</span>
          <span className="text-xs text-slate-500 font-medium uppercase tracking-widest">Hiscores</span>
        </div>
        <GameModeSelect value={gameModeFilter} onChange={setGameModeFilter} includeAll />
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className="h-12 rounded-xl bg-white/5 animate-pulse"
              style={{ animationDelay: `${i * 50}ms` }}
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <Image
            src={getSkillIcon(selectedSkill.icon)}
            alt=""
            width={48}
            height={48}
            className="w-12 h-12 object-contain mx-auto mb-3 opacity-30"
            unoptimized
          />
          <p className="text-lg font-semibold mb-1">No data yet</p>
          <p className="text-sm">No players tracked for {selectedSkill.name} with this filter.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
          {/* Column header */}
          <div className="grid grid-cols-[3rem_1fr_6rem_8rem] sm:grid-cols-[3rem_1fr_6rem_9rem] gap-0 border-b border-white/[0.06] px-4 py-2.5 text-[10px] uppercase tracking-widest text-slate-500">
            <span>Rank</span>
            <span>Player</span>
            <span className="text-right">Level</span>
            <span className="text-right">XP</span>
          </div>

          {filtered.map((entry, i) => {
            const gm = getGameMode(entry.game_mode ?? 'regular');
            return (
              <div
                key={`${entry.username}-${i}`}
                className={`grid grid-cols-[3rem_1fr_6rem_8rem] sm:grid-cols-[3rem_1fr_6rem_9rem] items-center gap-0 px-4 py-3 transition hover:bg-white/[0.025] ${
                  MEDAL_BG[i] ?? ''
                } ${i < filtered.length - 1 ? 'border-b border-white/[0.03]' : ''}`}
              >
                {/* Rank */}
                <span
                  className={`text-sm font-bold tabular-nums ${
                    MEDALS[i] ?? 'text-slate-600'
                  }`}
                >
                  {i + 1}
                </span>

                {/* Player */}
                <Link
                  href={`/player/${encodeURIComponent(entry.username ?? entry.name)}`}
                  className="flex items-center gap-2 text-sm font-semibold text-slate-200 hover:text-emerald-400 transition-colors truncate"
                >
                  {gm.emoji && (
                    <Image
                      src={gm.emoji}
                      alt={gm.label}
                      width={14}
                      height={14}
                      className={`shrink-0 opacity-90 ${gm.key === 'realism_group_ironman' ? 'h-4' : 'h-3.5'} w-auto`}
                      unoptimized
                    />
                  )}
                  <span className="truncate">{entry.name}</span>
                </Link>

                {/* Level */}
                <span className="text-right text-sm tabular-nums font-medium text-slate-300">
                  {entry.level.toLocaleString()}
                </span>

                {/* XP */}
                <span className="text-right text-sm tabular-nums font-medium text-slate-400">
                  {formatXp(entry.xp)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
