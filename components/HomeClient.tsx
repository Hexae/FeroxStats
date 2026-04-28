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
      <img src="/stats_icon.png" alt="" aria-hidden className="w-5 h-5 object-contain" />

    ),
  },
  {
    bg: '/hiscores.png',
    title: 'Hiscores & Rankings',
    desc: 'Browse the overall hiscore table and drill into individual skill rankings.',
    gradient: 'from-amber-900/25 to-amber-800/5',
    border: 'hover:border-amber-900/25',
    icon: (
      <img src="/hiscores_icon.png" alt="" aria-hidden className="w-5 h-5 object-contain" />
    ),
  },
  {
    bg: 'xp_progression.png',
    title: 'XP Progress',
    desc: 'Track experience across all skills with clean, readable formatting.',
    gradient: 'from-emerald-900/20 to-emerald-800/5',
    border: 'hover:border-emerald-900/25',
    icon: (
      <img src="/xp_icon.png" alt="" aria-hidden className="w-5 h-5 object-contain" />

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
    router.push(`/search?q=${encodeURIComponent(q)}`);
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
            Search players, Grand Exchange items, and update posts from one place.
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
                  placeholder="Search players, items, updates..."
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

      {/* ── Community Driven ── */}
      <section className="max-w-7xl mx-auto px-4 py-20 border-t border-white/[0.06]">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold text-white mb-3">Community driven</h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            FeroxStats is an open source project. Anyone in the community can contribute code or ideas to add new features and improvements.
          </p>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-center gap-4">
          <a
            href="https://github.com/Hexae/RSPS_Stats"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex gap-x-2 items-center whitespace-nowrap justify-center px-5 h-9 rounded-md text-sm font-medium transition-colors bg-gray-700 text-white hover:bg-gray-600 active:opacity-80 shadow-lg"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
              <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2Z" />
            </svg>
            Contribute on GitHub
          </a>

          <a
            href="https://discord.com/invite/feroxps"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex gap-x-2 items-center whitespace-nowrap justify-center px-5 h-9 rounded-md text-sm font-medium transition-colors bg-[#5865F2] text-white hover:bg-[#4752C4] active:opacity-80 shadow-lg"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
              <path d="M19.953 5.672c-1.906-1.53-4.918-1.79-5.047-1.8a.48.48 0 0 0-.473.281c-.004.012-.07.164-.145.398 1.258.21 2.805.64 4.207 1.508a.48.48 0 0 1-.254.887.475.475 0 0 1-.254-.074c-2.402-1.492-5.4-1.566-5.988-1.566S8.414 5.38 6.012 6.87a.48.48 0 0 1-.66-.152.478.478 0 0 1 .156-.66C6.906 5.19 8.453 4.762 9.71 4.55l-.145-.398a.472.472 0 0 0-.473-.28c-.13.012-3.14.27-5.07 1.824C3.016 6.625 1 12.074 1 16.78a.49.49 0 0 0 .063.238c1.39 2.445 5.184 3.082 6.05 3.113a.482.482 0 0 0 .402-.2l.875-1.203c-2.36-.61-3.566-1.645-3.633-1.703-.2-.176-.22-.477-.043-.676s.477-.22.672-.043c.03.027 2.25 1.9 6.613 1.9 4.37 0 6.6-1.895 6.613-1.9a.476.476 0 0 1 .632.715c-.07.063-1.277 1.098-3.637 1.707l.875 1.203c.1.125.234.195.387.195.883-.027 4.676-.664 6.066-3.11a.492.492 0 0 0 .063-.238c0-4.707-2.016-10.156-3.047-11.11zM8.89 14.87c-.922 0-1.672-.86-1.672-1.914s.746-1.914 1.672-1.914 1.676.86 1.676 1.914-.75 1.914-1.676 1.914zm6.22 0c-.926 0-1.676-.86-1.676-1.914s.75-1.914 1.676-1.914 1.672.86 1.672 1.914-.75 1.914-1.672 1.914zm0 0" />
            </svg>
            Join our Discord
          </a>

          <a
            href="https://patreon.com/feroxstats"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex gap-x-2 items-center whitespace-nowrap justify-center px-5 h-9 rounded-md text-sm font-medium transition-colors bg-[#FF424D] text-white hover:bg-[#E63539] active:opacity-80 shadow-lg"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
              <path d="M14.82 2.41c3.96 0 7.18 3.24 7.18 7.21 0 3.96-3.22 7.18-7.18 7.18-3.97 0-7.21-3.22-7.21-7.18 0-3.97 3.24-7.21 7.21-7.21M2 21.6h3.5V2.41H2V21.6Z" />
            </svg>
            See Patreon benefits
          </a>
        </div>
      </section>
    </div>
  );
}
