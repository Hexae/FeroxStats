'use client';

import Image from 'next/image';
import { useState, Fragment } from 'react';
import { SKILLS, getSkillIcon, formatXp, formatNumber, virtualLevel, type SkillData } from '@/lib/osrs';

interface PlayerResult {
  username: string;
  data: { name: string; skills: SkillData[] } | null;
  error?: string;
}

const PLAYER_COLORS = [
  'text-emerald-400',
  'text-sky-400',
  'text-amber-400',
  'text-purple-400',
  'text-rose-400',
];

export default function CompareClient() {
  const [input, setInput] = useState('');
  const [players, setPlayers] = useState<PlayerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCompare(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const names = input
      .split(',')
      .map(n => n.trim())
      .filter(Boolean);

    if (names.length < 2) {
      setError('Enter at least 2 player names separated by commas.');
      return;
    }
    if (names.length > 5) {
      setError('Maximum 5 players.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/compare?players=${encodeURIComponent(names.join(','))}`);
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Failed'); return; }
      setPlayers(json.players);
    } catch {
      setError('Failed to fetch comparison data.');
    } finally {
      setLoading(false);
    }
  }

  const validPlayers = players.filter(p => p.data);

  return (
    <main className="flex-1 max-w-7xl mx-auto px-4 py-10 w-full animate-fade-up">
      <h1 className="text-3xl font-extrabold text-white mb-2">Compare Players</h1>
      <p className="text-slate-400 text-sm mb-6">Enter 2–5 player names separated by commas. Players not yet tracked will be fetched automatically.</p>

      <form onSubmit={handleCompare} className="flex gap-3 mb-8">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="e.g. Hexae, GPA, Zooky"
          className="flex-1 bg-[#1e1c2a] border border-white/[0.07] rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold px-6 py-3 rounded-xl text-sm transition-all disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Compare'}
        </button>
      </form>

      {error && (
        <div className="mb-6 px-4 py-2.5 rounded-lg text-sm border bg-red-500/10 border-red-500/30 text-red-400">{error}</div>
      )}

      {loading && (
        <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03]">
          <div className="space-y-0">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-10 animate-pulse bg-white/5 border-b border-white/[0.03]" style={{ animationDelay: `${i * 40}ms` }} />
            ))}
          </div>
        </div>
      )}

      {players.length > 0 && players.some(p => p.error) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {players.filter(p => p.error).map(p => (
            <span key={p.username} className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-lg">
              {p.username}: {p.error}
            </span>
          ))}
        </div>
      )}

      {validPlayers.length >= 2 && (
        <div className="overflow-x-auto rounded-2xl border border-white/5 bg-white/[0.03]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="py-3 px-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky left-0 bg-[#17151f] z-10">Skill</th>
                {validPlayers.map((p, i) => (
                  <th key={p.username} colSpan={3} className="py-3 px-2 text-center">
                    <span className={`text-sm font-bold ${PLAYER_COLORS[i % PLAYER_COLORS.length]}`}>
                      {p.data!.name}
                    </span>
                  </th>
                ))}
              </tr>
              <tr className="border-b border-white/5 bg-[#17151f]/50">
                <th className="py-1.5 px-4 sticky left-0 bg-[#17151f] z-10" />
                {validPlayers.map(p => (
                  <Fragment key={p.username}>
                    <th className="py-1.5 px-2 text-[10px] text-slate-500 uppercase text-right">Lvl</th>
                    <th className="py-1.5 px-2 text-[10px] text-slate-500 uppercase text-right">XP</th>
                    <th className="py-1.5 px-2 text-[10px] text-slate-500 uppercase text-right">Rank</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {SKILLS.map(skill => {
                const playerSkills = validPlayers.map(p =>
                  p.data!.skills.find(s => s.id === skill.id)
                );
                // Determine best values for highlighting
                const levels = playerSkills.map(s => s?.level ?? 0);
                const xps = playerSkills.map(s => parseInt(s?.xp ?? '0'));
                const ranks = playerSkills.map(s => s?.rank ?? 999999);
                const bestLevel = Math.max(...levels);
                const bestXp = Math.max(...xps);
                const bestRank = Math.min(...ranks.filter(r => r > 0));

                return (
                  <tr key={skill.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="py-2 px-4 sticky left-0 bg-[#17151f]/80 z-10">
                      <div className="flex items-center gap-2">
                        <div className="relative h-4 w-4 shrink-0">
                          <Image src={getSkillIcon(skill.icon)} alt={skill.name} fill className="object-contain" unoptimized />
                        </div>
                        <span className="text-xs text-slate-300">{skill.name}</span>
                      </div>
                    </td>
                    {playerSkills.map((s, pi) => {
                      const lvl = s?.level ?? 0;
                      const xp = parseInt(s?.xp ?? '0');
                      const rank = s?.rank ?? 0;
                      const vLvl = lvl >= 99 ? virtualLevel(xp) : lvl;
                      return (
                        <Fragment key={pi}>
                          <td className={`py-2 px-2 text-right text-xs tabular-nums ${lvl === bestLevel && lvl > 0 ? 'text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                            {vLvl}
                          </td>
                          <td className={`py-2 px-2 text-right text-xs tabular-nums ${xp === bestXp && xp > 0 ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                            {formatXp(xp)}
                          </td>
                          <td className={`py-2 px-2 text-right text-xs tabular-nums ${rank === bestRank && rank > 0 ? 'text-amber-400 font-semibold' : 'text-slate-600'}`}>
                            {rank > 0 ? `#${formatNumber(rank)}` : '—'}
                          </td>
                        </Fragment>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
