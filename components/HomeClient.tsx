'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const FEATURES = [
  {
    bg: '/skills.png',
    title: 'Full Skill Breakdown',
    desc: 'View all 24 skills with level, XP, and server rank for any Ferox.ps player.',
    gradient: 'from-emerald-900/25 to-emerald-800/8',
    border: 'hover:border-emerald-900/30',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
      </svg>
    ),
  },
  {
    bg: '/hiscores.png',
    title: 'Hiscores & Rankings',
    desc: 'Browse the overall hiscore table and drill into individual skill rankings.',
    gradient: 'from-amber-900/25 to-amber-800/5',
    border: 'hover:border-amber-900/25',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
      </svg>
    ),
  },
  {
    bg: 'xp_progression.png',
    title: 'XP Progress',
    desc: 'Track experience across all skills with clean, readable formatting.',
    gradient: 'from-emerald-900/20 to-emerald-800/5',
    border: 'hover:border-emerald-900/25',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    bg: '/search.png',
    title: 'Instant Lookup',
    desc: 'Search any player by name and see their full stats in seconds.',
    gradient: 'from-blue-900/20 to-blue-800/5',
    border: 'hover:border-blue-900/25',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    bg: '/mobile.png',
    title: 'Mobile Friendly',
    desc: 'Fully responsive — check stats on desktop, tablet, or phone.',
    gradient: 'from-purple-900/20 to-purple-800/5',
    border: 'hover:border-purple-900/25',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" />
      </svg>
    ),
  },
  {
    bg: '/snapshot.png',
    title: 'Snapshot History',
    desc: 'Every search saves a snapshot, building a history of player progression.',
    gradient: 'from-cyan-900/20 to-cyan-800/5',
    border: 'hover:border-cyan-900/25',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
];

export default function HomeClient() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [stats, setStats] = useState({ playerCount: 0, rank1: 'N/A', topPlayers: [] as string[] });
  const [statsError, setStatsError] = useState(false);

  useEffect(() => {
    fetch('/api/stats')
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setStats)
      .catch(() => setStatsError(true));
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`/player/${encodeURIComponent(q)}`);
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Hero ── */}
      <section className="relative flex flex-col items-center justify-center min-h-[80vh] text-center px-4 overflow-hidden">
        {/* Background gradient orbs */}
        <div className="absolute inset-0 pointer-events-none select-none" aria-hidden>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-emerald-950/20 rounded-full blur-[140px]" />
          <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] bg-emerald-900/8 rounded-full blur-[100px]" />
          <div className="absolute top-1/4 right-1/4 w-[350px] h-[350px] bg-emerald-900/6 rounded-full blur-[120px]" />
          {/* Grid lines */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
              backgroundSize: '80px 80px',
            }}
          />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto animate-fade-up">
          {/* Live badge */}
          <div className="inline-flex items-center gap-2 bg-emerald-950/50 border border-emerald-900/40 text-emerald-400 text-xs font-semibold px-4 py-1.5 rounded-full mb-8 shadow-lg shadow-emerald-950/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse-green inline-block" />
            Live Analytics
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight mb-5 leading-[1.05]">
            Track your{' '}
            <span className="shimmer-text">journey</span>
            <br />
            <span className="text-white/90">on Ferox.ps</span>
          </h1>

          <p className="text-slate-400 text-lg sm:text-xl mb-10 max-w-2xl mx-auto leading-relaxed">
            Search any player to view their full skill breakdown, XP totals, and
            hiscore standings — all pulled live from Ferox.
          </p>

          {/* Search form */}
          <form onSubmit={handleSubmit} className="max-w-lg mx-auto mb-5">
            <div className={`flex gap-0 bg-[#1e1c2a]/80 border rounded-2xl overflow-hidden transition-all duration-300 shadow-xl ${
              focused
                ? 'border-emerald-500/50 shadow-emerald-950/40 shadow-2xl'
                : 'border-white/[0.1]'
            }`}>
              <div className="flex-1 relative">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder="Enter player name…"
                  className="w-full bg-transparent pl-11 pr-4 py-4 text-white placeholder-slate-500 focus:outline-none text-base"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold px-7 py-4 transition-all text-sm tracking-wide shadow-lg"
              >
                Search
              </button>
            </div>
          </form>

          {/* Quick links */}
          <div className="flex items-center justify-center gap-2 flex-wrap text-sm text-slate-500">
            {stats.topPlayers.length > 0 && <span>Try:</span>}
            {stats.topPlayers.map(p => (
              <Link
                key={p}
                href={`/player/${encodeURIComponent(p)}`}
                className="text-slate-400 hover:text-emerald-400 transition-colors px-2 py-0.5 rounded-lg hover:bg-emerald-950/20 border border-transparent hover:border-emerald-900/20"
              >
                {p}
              </Link>
            ))}
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-30">
          <span className="text-xs text-slate-400 tracking-widest uppercase">Scroll</span>
          <div className="w-px h-8 bg-gradient-to-b from-slate-400 to-transparent" />
        </div>
      </section>

      {/* ── Mini stats bar ── */}
      <section className="border-y border-white/[0.06] bg-[#1e1c2a]/60 py-5">
        <div className="max-w-7xl mx-auto px-4">
          {statsError ? (
            <p className="text-center text-sm text-slate-500">Unable to load stats right now.</p>
          ) : (
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-16">
            <div className="text-center">
              <p className="text-xl font-extrabold text-white">{stats.playerCount > 0 ? stats.playerCount.toLocaleString() : '—'}</p>
              <p className="text-xs text-slate-500 mt-0.5">Players Tracked</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-extrabold text-white">23</p>
              <p className="text-xs text-slate-500 mt-0.5">Skills</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-extrabold text-white">{stats.rank1}</p>
              <p className="text-xs text-slate-500 mt-0.5">Server Rank #1</p>
            </div>
          </div>
          )}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="max-w-7xl mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold text-white mb-3">Everything you need</h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            FeroxStats gives you deep insight into your Ferox.ps character — from raw XP numbers to server-wide rankings.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className={`group relative bg-[#1e1c2a]/80 border border-white/[0.07] ${f.border} rounded-2xl p-6 card-hover overflow-hidden`}
              style={f.bg && !f.bg.endsWith('.gif') && !f.bg.endsWith('.png') ? {
                backgroundImage: `linear-gradient(to bottom, rgba(30,28,42,0.55) 0%, rgba(30,28,42,0.92) 60%, #1e1c2a 100%), url(${JSON.stringify(f.bg)})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              } : {}}
            >
              {/* PNG/GIF background — uses img tag so transparency and animation work correctly */}
              {f.bg && (f.bg.endsWith('.gif') || f.bg.endsWith('.png')) && (
                <>
                  <img src={f.bg} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-b from-[#1e1c2a]/40 via-[#1e1c2a]/70 to-[#1e1c2a]" />
                </>
              )}

              {/* Background gradient fill */}
              <div className={`absolute inset-0 bg-gradient-to-br ${f.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl`} />

              <div className="relative z-10">
                <div className="w-10 h-10 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center mb-4 text-slate-300">
                  {f.icon}
                </div>
                <h3 className="font-bold text-white mb-2 text-lg">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
