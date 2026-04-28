'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect, useRef, startTransition, useMemo } from 'react';
import useSWR from 'swr';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase';
import type { UnifiedSearchResponse, UnifiedSearchResult } from '@/lib/search-types';

interface Competition {
  id: string;
  name: string;
  metric: string;
  starts_at: string;
  ends_at: string;
  group_id: string;
  group_name: string;
  group_slug: string;
  participant_count: number;
  status: 'active' | 'upcoming';
  progress_pct: number;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const compFetcher = (url: string) => fetch(url).then((r) => r.json());

const METRIC_EMOJI: Record<string, string> = {
  overall: '⚔️', attack: '🗡️', defence: '🛡️', strength: '💪', hitpoints: '❤️',
  ranged: '🏹', prayer: '🙏', magic: '🔮', cooking: '🍳', woodcutting: '🪓',
  fletching: '🪃', fishing: '🎣', firemaking: '🔥', crafting: '⚒️', smithing: '🔨',
  mining: '⛏️', herblore: '🌿', agility: '🏃', thieving: '🗝️', slayer: '💀',
  farming: '🌾', runecraft: '✨', hunter: '🦅', construction: '🏠',
};

function compTimeLabel(dateStr: string, status: 'active' | 'upcoming'): string {
  const ms = new Date(dateStr).getTime() - Date.now();
  const abs = Math.abs(ms);
  const mins = Math.floor(abs / 60000);
  if (mins < 60) return status === 'active' ? `${mins}m left` : `in ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return status === 'active' ? `${hrs}h left` : `in ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return status === 'active' ? `${days}d left` : `in ${days}d`;
}

const SEARCH_TYPE_LABEL: Record<UnifiedSearchResult['type'], string> = {
  player: 'Player',
  item: 'Item',
  update: 'Update',
};

// ─── CompetitionCard ──────────────────────────────────────────────────────────

// ─── GroupsDropdown ──────────────────────────────────────────────────────────

function GroupsDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { startTransition(() => setOpen(false)); }, [pathname]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          open
            ? 'bg-[hsl(220_23%_15%)] text-white'
            : 'text-[hsl(220_20%_64%)] hover:text-white hover:bg-[hsl(220_23%_15%)]'
        }`}
      >
        Groups
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 z-50 w-44 overflow-hidden rounded-xl border border-white/10 bg-[hsl(220_23%_9%)] shadow-xl shadow-black/60">
          <Link
            href="/groups"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors"
          >
            Groups
          </Link>
          <Link
            href="/competitions"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors"
          >
            Competitions
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── MobileGroupsSection ─────────────────────────────────────────────────────

function MobileGroupsSection({ onClose }: { onClose: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const { data: comps, isLoading } = useSWR<Competition[]>(
    expanded ? '/api/competitions' : null,
    compFetcher,
    { revalidateOnFocus: false }
  );

  const items = comps?.filter((c) => c.status === 'active' || c.status === 'upcoming') ?? [];

  return (
    <div>
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-md text-sm font-medium text-[hsl(220_20%_64%)] hover:text-white hover:bg-[hsl(220_23%_15%)] transition-colors"
      >
        <span>Groups</span>
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="mx-2 mt-1 mb-1 rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
          {/* Static links */}
          <Link
            href="/groups"
            onClick={onClose}
            className="flex items-center gap-2.5 px-3 py-2.5 border-b border-white/[0.05] hover:bg-white/[0.04] transition-colors"
          >
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span className="text-sm font-medium text-slate-200">All Groups</span>
          </Link>
          <Link
            href="/competitions"
            onClick={onClose}
            className="flex items-center gap-2.5 px-3 py-2.5 border-b border-white/[0.05] hover:bg-white/[0.04] transition-colors"
          >
            <span className="text-base leading-none">🏆</span>
            <span className="text-sm font-medium text-slate-200">All Competitions</span>
          </Link>
          {/* Dynamic competition list */}
          {isLoading && (
            <div className="p-3 space-y-2">
              {[...Array(2)].map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-white/5" />)}
            </div>
          )}
          {!isLoading && items.length === 0 && (
            <p className="px-4 py-3 text-xs text-slate-500">No active competitions right now.</p>
          )}
          {items.map((comp) => (
            <Link
              key={comp.id}
              href={`/competitions/${comp.id}`}
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 border-b border-white/[0.05] last:border-0 hover:bg-white/[0.04] transition-colors"
            >
              <span className="text-base">{METRIC_EMOJI[comp.metric.toLowerCase()] ?? '⚔️'}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-200">{comp.name}</p>
                <p className="text-[11px] text-slate-500">
                  {comp.group_name} · {comp.status === 'active' ? compTimeLabel(comp.ends_at, 'active') : compTimeLabel(comp.starts_at, 'upcoming')}
                </p>
              </div>
              <span className={`shrink-0 text-[10px] font-semibold ${comp.status === 'active' ? 'text-emerald-400' : 'text-sky-400'}`}>
                {comp.status === 'active' ? 'Live' : 'Soon'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
// ─── Navbar ───────────────────────────────────────────────────────────────────

export default function Navbar() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [suggestions, setSuggestions] = useState<UnifiedSearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (search.trim().length < 1) {
      startTransition(() => {
        setSuggestions([]);
        setShowSuggestions(false);
      });
      return;
    }
    debounceRef.current = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(search.trim())}&mode=suggest`)
        .then(r => r.json())
        .then((data: UnifiedSearchResponse) => {
          const results = data?.results ?? [];
          setSuggestions(results);
          setShowSuggestions(results.length > 0);
          setSelectedIdx(-1);
        })
        .catch(() => {
          setSuggestions([]);
          setShowSuggestions(false);
        });
    }, 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  function closeSearchUi() {
    setSearch('');
    setShowSuggestions(false);
    setMenuOpen(false);
  }

  function navigateToQuery(query: string) {
    router.push(`/search?q=${encodeURIComponent(query)}`);
    closeSearchUi();
  }

  function navigateToResult(result: UnifiedSearchResult) {
    router.push(result.href);
    closeSearchUi();
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    navigateToQuery(q);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(prev => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(prev => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' && selectedIdx >= 0) {
      e.preventDefault();
      navigateToResult(suggestions[selectedIdx]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  }

  const initials = user?.email?.charAt(0).toUpperCase() ?? '?';

  return (
    <>
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-[hsl(220_23%_20%)] bg-[hsl(220_23%_11%)] px-4 sm:px-7 shadow-lg">
        {/* Mobile hamburger */}
        <button
          className="lg:hidden p-1 text-[hsl(220_20%_64%)] hover:text-white transition-colors"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          {menuOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          )}
        </button>

        {/* Logo - desktop */}
        <Link href="/" className="hidden lg:flex items-center gap-2.5 shrink-0 mr-6">
          <img src="/logo/logo.png" alt="FeroxStats" className="h-8 w-auto" />
          <span className="font-bold text-base tracking-tight text-white">
            Ferox<span className="text-blue-400">Stats</span>
          </span>
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden lg:flex items-center gap-1 mr-4">
          <Link href="/compare" className="px-3 py-1.5 rounded-md text-sm font-medium text-[hsl(220_20%_64%)] hover:text-white hover:bg-[hsl(220_23%_15%)] transition-colors">
            Compare
          </Link>
          <Link href="/top-gains" className="px-3 py-1.5 rounded-md text-sm font-medium text-[hsl(220_20%_64%)] hover:text-white hover:bg-[hsl(220_23%_15%)] transition-colors">
            Top Gains
          </Link>
          <GroupsDropdown />
          <Link href="/ge" className="px-3 py-1.5 rounded-md text-sm font-medium text-[hsl(220_20%_64%)] hover:text-white hover:bg-[hsl(220_23%_15%)] transition-colors">
            G.E.
          </Link>
          <Link href="/updates" className="px-3 py-1.5 rounded-md text-sm font-medium text-[hsl(220_20%_64%)] hover:text-white hover:bg-[hsl(220_23%_15%)] transition-colors">
            Updates
          </Link>
          <a 
            href="https://ferox.ps"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-[hsl(220_20%_64%)] hover:text-white hover:bg-[hsl(220_23%_15%)] transition-colors"
          >
            Ferox.ps
            <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
            </svg>
          </a>
        </nav>

        {/* Logo - mobile */}
        <Link href="/" className="lg:hidden flex items-center gap-2 shrink-0">
          <span className="font-bold text-base text-white">Ferox<span className="text-blue-400">Stats</span></span>
        </Link>

        {/* Search */}
        <div className="flex-1 flex justify-end px-4 sm:px-8">
          <form onSubmit={handleSearch} className="w-48 sm:w-60">
            <div className="relative" ref={wrapperRef}>
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(220_23%_43%)] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                onKeyDown={handleKeyDown}
                placeholder="Search players, items, updates..."
                role="combobox"
                aria-expanded={showSuggestions && suggestions.length > 0}
                aria-controls="search-suggestions"
                aria-autocomplete="list"
                aria-activedescendant={selectedIdx >= 0 ? `suggestion-${selectedIdx}` : undefined}
                className="w-full h-10 rounded-md border border-[hsl(220_23%_20%)] bg-[hsl(220_23%_4%)] pl-9 pr-3 text-sm text-[hsl(220_18%_83%)] placeholder:text-[hsl(220_23%_43%)] shadow-inner focus:outline-none focus:ring-1 focus:ring-[hsl(220_23%_31%)] focus:bg-black transition-colors"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div id="search-suggestions" role="listbox" className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-white/10 bg-[hsl(220_23%_11%)] shadow-2xl overflow-hidden">
                  {suggestions.map((s, i) => (
                    <button
                      key={s.id}
                      id={`suggestion-${i}`}
                      role="option"
                      aria-selected={i === selectedIdx}
                      type="button"
                      onMouseDown={() => navigateToResult(s)}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                        i === selectedIdx ? 'bg-emerald-600/20 text-white' : 'text-slate-300 hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium truncate">{s.label}</span>
                        <span className="shrink-0 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                          {SEARCH_TYPE_LABEL[s.type]}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500 truncate">
                        {s.type === 'player' && s.displayName.toLowerCase() !== s.username
                          ? `${s.subtitle ?? 'Player'} · @${s.username}`
                          : s.subtitle}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Auth */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          {user ? (
            <Link
              href="/account"
              className="flex items-center gap-2 rounded-md border border-[hsl(220_23%_20%)] bg-[hsl(220_23%_15%)] hover:bg-[hsl(220_23%_20%)] px-3 py-1.5 text-sm font-medium text-[hsl(220_18%_83%)] transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-blue-700 flex items-center justify-center text-white text-xs font-bold">
                {initials}
              </div>
              Account
            </Link>
          ) : (
            <>
              <Link href="/auth/login" className="text-sm font-medium text-[hsl(220_20%_64%)] hover:text-white px-3 py-1.5 rounded-md hover:bg-[hsl(220_23%_15%)] transition-colors">
                Sign In
              </Link>
              <Link href="/auth/register" className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 px-3.5 py-1.5 rounded-md transition-colors shadow shadow-blue-900/40">
                Register
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Mobile slide-down menu */}
      {menuOpen && (
        <div className="lg:hidden fixed top-16 left-0 right-0 z-40 border-b border-[hsl(220_23%_20%)] bg-[hsl(220_23%_11%)] px-4 py-3 flex flex-col gap-1 shadow-2xl">
          <form onSubmit={handleSearch} className="mb-2">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(220_23%_43%)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search players, items, updates..."
                className="w-full h-10 rounded-md border border-[hsl(220_23%_20%)] bg-[hsl(220_23%_4%)] pl-9 pr-3 text-sm text-[hsl(220_18%_83%)] placeholder:text-[hsl(220_23%_43%)] focus:outline-none focus:ring-1 focus:ring-[hsl(220_23%_31%)] transition-colors"
              />
            </div>
          </form>
          <div className="border-t border-[hsl(220_23%_20%)] pt-2 flex flex-col gap-1">
            <Link href="/compare" onClick={() => setMenuOpen(false)} className="px-4 py-2.5 rounded-md text-sm font-medium text-[hsl(220_20%_64%)] hover:text-white hover:bg-[hsl(220_23%_15%)] transition-colors">Compare</Link>
            <Link href="/top-gains" onClick={() => setMenuOpen(false)} className="px-4 py-2.5 rounded-md text-sm font-medium text-[hsl(220_20%_64%)] hover:text-white hover:bg-[hsl(220_23%_15%)] transition-colors">Top Gains</Link>
            <MobileGroupsSection onClose={() => setMenuOpen(false)} />
            <Link href="/ge" onClick={() => setMenuOpen(false)} className="px-4 py-2.5 rounded-md text-sm font-medium text-[hsl(220_20%_64%)] hover:text-white hover:bg-[hsl(220_23%_15%)] transition-colors">G.E.</Link>
            <Link href="/updates" onClick={() => setMenuOpen(false)} className="px-4 py-2.5 rounded-md text-sm font-medium text-[hsl(220_20%_64%)] hover:text-white hover:bg-[hsl(220_23%_15%)] transition-colors">Updates</Link>
            <Link href="/api-docs" onClick={() => setMenuOpen(false)} className="px-4 py-2.5 rounded-md text-sm font-medium text-[hsl(220_20%_64%)] hover:text-white hover:bg-[hsl(220_23%_15%)] transition-colors">API</Link>
            {user ? (
              <Link href="/account" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium text-[hsl(220_20%_64%)] hover:text-white hover:bg-[hsl(220_23%_15%)] transition-colors">
                <div className="w-5 h-5 rounded-full bg-blue-700 flex items-center justify-center text-white text-xs font-bold">{initials}</div>
                Account
              </Link>
            ) : (
              <>
                <Link href="/auth/login" onClick={() => setMenuOpen(false)} className="px-4 py-2.5 rounded-md text-sm font-medium text-[hsl(220_20%_64%)] hover:text-white hover:bg-[hsl(220_23%_15%)] transition-colors">Sign In</Link>
                <Link href="/auth/register" onClick={() => setMenuOpen(false)} className="px-4 py-2.5 rounded-md text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors">Register</Link>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}