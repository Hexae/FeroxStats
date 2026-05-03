'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getGameMode, GAME_MODES, GameModeKey, formatNumber } from '@/lib/osrs';
import GameModeSelect from '@/components/GameModeSelect';

interface Player {
  username: string;
  display_name: string;
  game_mode: string;
  total_level: number;
  overall_rank: number;
  claimed_by: string | null;
  claimed_at: string | null;
  last_fetched_at: string | null;
}

interface UserProfile {
  id: string;
  email: string | null;
  is_admin: boolean;
  created_at: string | null;
}

interface Group {
  id: string;
  name: string;
  slug: string;
  discord_verified: boolean | null;
  members_count: number;
  created_at: string | null;
}

interface GameUpdate {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  category: string;
  image: string;
  markdown: string;
  published_at: string;
  is_published: boolean;
  created_at: string | null;
}

interface Props {
  players: Player[];
  userProfiles: UserProfile[];
  groups: Group[];
  updates: GameUpdate[];
}

type Tab = 'players' | 'users' | 'groups' | 'updates';

type UpdateForm = {
  id?: number;
  slug: string;
  title: string;
  summary: string;
  category: string;
  image: string;
  markdown: string;
  publishedAtISO: string;
  isPublished: boolean;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function createEmptyForm(): UpdateForm {
  return {
    slug: '',
    title: '',
    summary: '',
    category: 'Game Update',
    image: '/snapshot.png',
    markdown: '## Patch Notes\n- Add your first change here',
    publishedAtISO: new Date().toISOString().slice(0, 16),
    isPublished: true,
  };
}

function fromUpdate(update: GameUpdate): UpdateForm {
  return {
    id: update.id,
    slug: update.slug,
    title: update.title,
    summary: update.summary ?? '',
    category: update.category,
    image: update.image,
    markdown: update.markdown,
    publishedAtISO: update.published_at.slice(0, 16),
    isPublished: update.is_published,
  };
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function AdminClient({ players, userProfiles, groups, updates }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('players');
  const [search, setSearch] = useState('');
  const [gameModeFilter, setGameModeFilter] = useState<string>('all');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [updatingMode, setUpdatingMode] = useState<string | null>(null);
  const [togglingGroup, setTogglingGroup] = useState<string | null>(null);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [deletingUpdate, setDeletingUpdate] = useState(false);
  const [updateForm, setUpdateForm] = useState<UpdateForm>(createEmptyForm());
  const [claimFilter, setClaimFilter] = useState<'all' | 'claimed' | 'unclaimed'>('all');
  const [sortField, setSortField] = useState<'rank' | 'name' | 'level'>('rank');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [userSearch, setUserSearch] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [playerLog, setPlayerLog] = useState<{ id: number; action: string; detail: string | null; admin_email: string | null; created_at: string }[]>([]);
  const [loadingLog, setLoadingLog] = useState(false);

  async function openPlayer(p: Player) {
    setSelectedPlayer(p);
    setPlayerLog([]);
    setLoadingLog(true);
    try {
      const r = await fetch(`/api/admin/player-log?username=${encodeURIComponent(p.username)}`);
      const data = await r.json();
      setPlayerLog(data.log ?? []);
    } catch { /* ignore */ } finally {
      setLoadingLog(false);
    }
  }

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 5000);
    return () => clearTimeout(t);
  }, [msg]);

  function toggleSort(field: 'rank' | 'name' | 'level') {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = players.filter((p) => {
      const matchesSearch = p.username.toLowerCase().includes(q) || p.display_name.toLowerCase().includes(q);
      const matchesMode = gameModeFilter === 'all' || p.game_mode === gameModeFilter;
      const matchesClaim =
        claimFilter === 'all' ||
        (claimFilter === 'claimed' && !!p.claimed_by) ||
        (claimFilter === 'unclaimed' && !p.claimed_by);
      return matchesSearch && matchesMode && matchesClaim;
    });
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'rank') cmp = (a.overall_rank || 999999) - (b.overall_rank || 999999);
      else if (sortField === 'name') cmp = a.display_name.localeCompare(b.display_name);
      else if (sortField === 'level') cmp = b.total_level - a.total_level;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [players, search, gameModeFilter, claimFilter, sortField, sortDir]);

  const sortedUpdates = useMemo(
    () => [...updates].sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime()),
    [updates],
  );

  async function overrideGameMode(username: string, mode: GameModeKey) {
    setMsg(null);
    setUpdatingMode(username);
    const res = await fetch('/api/admin/gamemode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, game_mode: mode }),
    });
    setUpdatingMode(null);
    if (!res.ok) {
      const data = await res.json();
      setMsg({ type: 'err', text: `Failed: ${data.error}` });
      return;
    }
    setMsg({ type: 'ok', text: `Updated ${username} -> ${mode}` });
    router.refresh();
  }

  async function unclaim(username: string) {
    if (!confirm(`Unclaim profile for "${username}"?`)) return;
    setMsg(null);
    const res = await fetch('/api/admin/unclaim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    if (!res.ok) {
      const data = await res.json();
      setMsg({ type: 'err', text: data.error });
      return;
    }
    setMsg({ type: 'ok', text: `Unclaimed ${username}` });
    router.refresh();
  }

  async function toggleAdmin(userId: string, current: boolean) {
    setMsg(null);
    const res = await fetch('/api/admin/toggle-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, isAdmin: !current }),
    });
    if (!res.ok) {
      const data = await res.json();
      setMsg({ type: 'err', text: data.error });
      return;
    }
    setMsg({ type: 'ok', text: 'Admin status updated.' });
    router.refresh();
  }

  async function toggleVerified(groupId: string, current: boolean) {
    setMsg(null);
    setTogglingGroup(groupId);
    const res = await fetch('/api/admin/verify-group', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, verified: !current }),
    });
    setTogglingGroup(null);
    if (!res.ok) {
      const data = await res.json();
      setMsg({ type: 'err', text: data.error });
      return;
    }
    setMsg({ type: 'ok', text: !current ? 'Group verified.' : 'Verification removed.' });
    router.refresh();
  }

  function startNewUpdate() {
    setUpdateForm(createEmptyForm());
  }

  function pickUpdate(update: GameUpdate) {
    setUpdateForm(fromUpdate(update));
    setTab('updates');
  }

  function setUpdateField<K extends keyof UpdateForm>(key: K, value: UpdateForm[K]) {
    setUpdateForm((current) => ({
      ...current,
      [key]: value,
      slug:
        key === 'title' && (!current.id || !current.slug)
          ? slugify(String(value))
          : current.slug,
    }));
  }

  async function saveUpdate() {
    if (!updateForm.title.trim() || !updateForm.markdown.trim()) {
      setMsg({ type: 'err', text: 'Title and markdown are required.' });
      return;
    }

    setSavingUpdate(true);
    setMsg(null);

    const payload = {
      id: updateForm.id,
      slug: updateForm.slug.trim() || slugify(updateForm.title),
      title: updateForm.title,
      summary: updateForm.summary,
      category: updateForm.category,
      image: updateForm.image,
      markdown: updateForm.markdown,
      publishedAtISO: new Date(updateForm.publishedAtISO).toISOString(),
      isPublished: updateForm.isPublished,
    };

    const res = await fetch('/api/admin/updates', {
      method: updateForm.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setSavingUpdate(false);

    if (!res.ok) {
      const data = await res.json();
      setMsg({ type: 'err', text: data.error ?? 'Failed to save update.' });
      return;
    }

    setMsg({ type: 'ok', text: updateForm.id ? 'Update saved.' : 'Update created.' });
    router.refresh();
  }

  async function deleteUpdate() {
    if (!updateForm.id) {
      return;
    }

    if (!confirm('Delete this update permanently?')) {
      return;
    }

    setDeletingUpdate(true);
    setMsg(null);

    const res = await fetch('/api/admin/updates', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: updateForm.id }),
    });

    setDeletingUpdate(false);

    if (!res.ok) {
      const data = await res.json();
      setMsg({ type: 'err', text: data.error ?? 'Failed to delete update.' });
      return;
    }

    setMsg({ type: 'ok', text: 'Update deleted.' });
    startNewUpdate();
    router.refresh();
  }

  const TABS = [
    { key: 'players'  as Tab, label: 'Players',  count: players.length },
    { key: 'users'    as Tab, label: 'Users',    count: userProfiles.length },
    { key: 'groups'   as Tab, label: 'Groups',   count: groups.length },
    { key: 'updates'  as Tab, label: 'Updates',  count: updates.length },
  ] as const;

  return (
    <>
    <div className="relative min-h-screen bg-[#07060f] text-slate-200 font-sans flex">

      {/* ── Left Sidebar ───────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-56 xl:w-64 shrink-0 min-h-screen bg-[#0b0a16] border-r border-white/[0.04]">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-white/[0.04]">
          <div className="flex items-center gap-2.5">
            <Image src="/logo/logo.png" alt="FeroxStats" width={32} height={32} className="h-8 w-auto shrink-0" />
            <div>
              <div className="font-bold text-[15px] tracking-tight text-white leading-none">
                Ferox<span className="text-blue-400">Stats</span>
              </div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-slate-600 font-semibold mt-0.5">
                Admin Panel
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <div className="px-3 py-4 flex-1 space-y-0.5">
          <Link
            href="/"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-200 hover:bg-white/[0.03] transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            View Site
          </Link>
          <Link
            href="/account"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-200 hover:bg-white/[0.03] transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            Account
          </Link>
          <div className="my-2 border-t border-white/[0.04]" />
          <div className="pt-2 pb-1">
            <p className="px-3 text-[10px] uppercase tracking-[0.14em] text-slate-600 font-bold">Navigation</p>
          </div>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-[13px] font-semibold transition-all ${
                tab === t.key
                  ? 'bg-emerald-500/10 text-white border border-emerald-500/15'
                  : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.03]'
              }`}
            >
              <span>{t.label}</span>
              <span className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full ${
                tab === t.key ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/[0.04] text-slate-600'
              }`}>{t.count}</span>
            </button>
          ))}
        </div>
      </aside>

      {/* ── Main column ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">

        {/* Page content */}
        <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">

          {/* Page heading */}
          <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-slate-600 font-bold mb-1">Dashboard</p>
              <h1 className="text-2xl font-black text-white tracking-tight">
                {tab === 'players' ? 'Players' : tab === 'users' ? 'Accounts' : tab === 'groups' ? 'Groups' : 'Updates'}
              </h1>
            </div>
            {tab === 'players' && (
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search players…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="bg-white/[0.03] border border-white/[0.06] rounded-lg pl-9 pr-4 py-2 text-white text-sm w-56 focus:outline-none focus:border-emerald-500/40 transition-colors placeholder-slate-600"
                  />
                </div>
                <GameModeSelect value={gameModeFilter} onChange={setGameModeFilter} includeAll />
              </div>
            )}
            {tab === 'users' && (
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by email…"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="bg-white/[0.03] border border-white/[0.06] rounded-lg pl-9 pr-4 py-2 text-white text-sm w-64 focus:outline-none focus:border-emerald-500/40 transition-colors placeholder-slate-600"
                />
              </div>
            )}
          </div>

          {/* Toast */}
          {msg && (
            <div className={`mb-6 px-4 py-3 rounded-xl text-sm flex items-center justify-between gap-4 border ${
              msg.type === 'ok'
                ? 'bg-emerald-500/8 border-emerald-500/20 text-emerald-300'
                : 'bg-red-500/8 border-red-500/20 text-red-300'
            }`}>
              <div className="flex items-center gap-2.5">
                {msg.type === 'ok' ? (
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                )}
                {msg.text}
              </div>
              <button onClick={() => setMsg(null)} className="opacity-40 hover:opacity-100 transition-opacity shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          )}

          {/* Stat cards – always visible */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {[
              { label: 'Players',  value: players.length,      color: 'text-emerald-400', dim: 'border-emerald-500/15 bg-emerald-500/5' },
              { label: 'Claimed',  value: players.filter(p => !!p.claimed_by).length, color: 'text-sky-400', dim: 'border-sky-500/15 bg-sky-500/5' },
              { label: 'Accounts', value: userProfiles.length, color: 'text-violet-400', dim: 'border-violet-500/15 bg-violet-500/5' },
              { label: 'Groups',   value: groups.length,       color: 'text-amber-400',  dim: 'border-amber-500/15 bg-amber-500/5' },
            ].map((s) => (
              <div key={s.label} className={`rounded-2xl border ${s.dim} px-4 py-4`}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">{s.label}</p>
                <p className={`text-2xl font-black tabular-nums ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* ── Tab content card ─────────────────────────────────────── */}
          <div className="rounded-2xl border border-white/[0.06] bg-[#0e0d1a] overflow-hidden">

          {/* ── Players ──────────────────────────────────────────────────── */}
          {tab === 'players' && (
            <div>
              {/* Toolbar: claim filter only */}
              <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-white/[0.04]">
                <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-lg p-1">
                  {(['all', 'claimed', 'unclaimed'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setClaimFilter(f)}
                      className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-all ${
                        claimFilter === f ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >{f}</button>
                  ))}
                </div>
                <span className="ml-auto text-xs text-slate-600 tabular-nums shrink-0">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.04]">
                      {[
                        { label: 'Player', field: 'name' as const, align: 'text-left' },
                        { label: 'Game Mode', field: null, align: 'text-left' },
                        { label: 'Level', field: 'level' as const, align: 'text-right' },
                        { label: 'Rank', field: 'rank' as const, align: 'text-right' },
                        { label: 'Last Seen', field: null, align: 'text-left' },
                        { label: 'Status', field: null, align: 'text-left' },
                        { label: '', field: null, align: 'text-right' },
                      ].map((col) => (
                        <th
                          key={col.label || 'actions'}
                          className={`py-2.5 px-4 text-[10px] font-semibold text-slate-600 uppercase tracking-widest ${col.align} ${col.field ? 'cursor-pointer select-none hover:text-slate-400 transition-colors' : ''}`}
                          onClick={col.field ? () => toggleSort(col.field!) : undefined}
                        >
                          <span className="inline-flex items-center gap-1">
                            {col.label}
                            {col.field && (
                              sortField === col.field
                                ? <span className="text-emerald-400">{sortDir === 'asc' ? '↑' : '↓'}</span>
                                : <span className="opacity-20">↕</span>
                            )}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.025]">
                    {filtered.map((p) => {
                      return (
                        <tr key={p.username} className="group hover:bg-white/[0.015] transition-colors">
                          <td className="py-3 px-4">
                            <button
                              onClick={() => openPlayer(p)}
                              className="text-left group/btn"
                            >
                              <p className="text-sm font-semibold text-slate-200 group-hover/btn:text-emerald-400 transition-colors">{p.display_name}</p>
                              <p className="text-xs text-slate-600 font-mono">{p.username}</p>
                            </button>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <select
                                value={p.game_mode}
                                disabled={updatingMode === p.username}
                                onChange={(e) => overrideGameMode(p.username, e.target.value as GameModeKey)}
                                className="bg-[#0e0d17] border border-white/[0.07] rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/40 disabled:opacity-40 transition-colors"
                              >
                                {GAME_MODES.map((m) => (
                                  <option key={m.key} value={m.key}>{m.label}</option>
                                ))}
                              </select>
                              {updatingMode === p.username && (
                                <svg className="w-3.5 h-3.5 text-emerald-400 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                </svg>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="text-xs font-mono tabular-nums text-slate-400">{p.total_level > 0 ? formatNumber(p.total_level) : '—'}</span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="text-xs font-mono tabular-nums text-slate-500">{p.overall_rank > 0 ? `#${formatNumber(p.overall_rank)}` : '—'}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-xs text-slate-600 tabular-nums">{timeAgo(p.last_fetched_at)}</span>
                          </td>
                          <td className="py-3 px-4">
                            {p.claimed_by ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                Claimed
                              </span>
                            ) : (
                              <span className="text-xs text-slate-700">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => openPlayer(p)}
                                className="text-[10px] font-semibold text-slate-400 hover:text-emerald-400 bg-white/[0.04] hover:bg-emerald-500/10 border border-white/[0.06] hover:border-emerald-500/20 px-2 py-1 rounded-lg transition-all"
                              >
                                Details
                              </button>
                              {p.claimed_by && (
                                <button
                                  onClick={() => unclaim(p.username)}
                                  className="text-[10px] font-semibold text-red-400 hover:text-red-300 bg-red-500/8 hover:bg-red-500/15 border border-red-500/15 hover:border-red-500/30 px-2 py-1 rounded-lg transition-all"
                                >
                                  Unclaim
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-16 text-center">
                          <p className="text-sm text-slate-600">No players match your filters.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Users ───────────────────────────────────────────────────── */}
          {tab === 'users' && (
            <div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    <th className="py-2.5 px-5 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Email</th>
                    <th className="py-2.5 px-5 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Joined</th>
                    <th className="py-2.5 px-5 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.025]">
                  {userProfiles
                    .filter(u => !userSearch || (u.email ?? '').toLowerCase().includes(userSearch.toLowerCase()))
                    .map((u) => (
                      <tr key={u.id} className="hover:bg-white/[0.015] transition-colors">
                        <td className="py-3.5 px-5">
                          <span className="text-sm text-slate-300 font-medium">{u.email ?? '—'}</span>
                        </td>
                        <td className="py-3.5 px-5">
                          <span className="text-xs text-slate-600">{u.created_at ? new Date(u.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span>
                        </td>
                        <td className="py-3.5 px-5">
                          <button
                            onClick={() => toggleAdmin(u.id, u.is_admin)}
                            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border transition-all ${
                              u.is_admin
                                ? 'bg-amber-500/10 border-amber-500/25 text-amber-400 hover:bg-amber-500/5'
                                : 'bg-white/[0.03] border-white/[0.07] text-slate-500 hover:text-slate-300 hover:border-white/[0.12]'
                            }`}
                          >
                            {u.is_admin ? (
                              <>
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                Admin
                              </>
                            ) : 'Grant Admin'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  {userProfiles.filter(u => !userSearch || (u.email ?? '').toLowerCase().includes(userSearch.toLowerCase())).length === 0 && (
                    <tr><td colSpan={3} className="py-16 text-center text-sm text-slate-600">No users found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Groups ──────────────────────────────────────────────────── */}
          {tab === 'groups' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    <th className="py-2.5 px-5 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Group</th>
                    <th className="py-2.5 px-5 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Members</th>
                    <th className="py-2.5 px-5 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Created</th>
                    <th className="py-2.5 px-5 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Discord</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.025]">
                  {groups.map((g) => (
                    <tr key={g.id} className="hover:bg-white/[0.015] transition-colors">
                      <td className="py-3.5 px-5">
                        <Link href={`/groups/${g.slug}`} className="text-sm font-semibold text-slate-200 hover:text-emerald-400 transition-colors">
                          {g.name}
                        </Link>
                        <p className="text-xs text-slate-600 font-mono">{g.slug}</p>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="text-sm text-slate-400 tabular-nums">{g.members_count}</span>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="text-xs text-slate-600">{g.created_at ? new Date(g.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span>
                      </td>
                      <td className="py-3.5 px-5">
                        <button
                          disabled={togglingGroup === g.id}
                          onClick={() => toggleVerified(g.id, !!g.discord_verified)}
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border transition-all disabled:opacity-50 ${
                            g.discord_verified
                              ? 'bg-indigo-500/10 border-indigo-500/25 text-indigo-400 hover:bg-indigo-500/5'
                              : 'bg-white/[0.03] border-white/[0.07] text-slate-500 hover:text-slate-300 hover:border-white/[0.12]'
                          }`}
                        >
                          {g.discord_verified ? (
                            <>
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                              Verified
                            </>
                          ) : 'Verify'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {groups.length === 0 && (
                    <tr><td colSpan={4} className="py-16 text-center text-sm text-slate-600">No groups yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Updates ─────────────────────────────────────────────────── */}
          {tab === 'updates' && (
            <div className="grid lg:grid-cols-[280px_1fr] divide-x divide-white/[0.04]">
              {/* Sidebar list */}
              <div className="flex flex-col">
                <div className="px-4 py-3 border-b border-white/[0.04] flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">All Updates</span>
                  <button
                    onClick={startNewUpdate}
                    className="flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/8 hover:bg-emerald-500/12 border border-emerald-500/20 px-2.5 py-1 rounded-lg transition-all"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                    New
                  </button>
                </div>
                <div className="overflow-y-auto max-h-[700px] divide-y divide-white/[0.03]">
                  {sortedUpdates.map((update) => (
                    <button
                      key={update.id}
                      onClick={() => pickUpdate(update)}
                      className={`w-full px-4 py-3 text-left transition-colors hover:bg-white/[0.02] ${
                        updateForm.id === update.id ? 'bg-emerald-500/5 border-l-2 border-l-emerald-500' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                          update.is_published ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                        }`}>{update.is_published ? 'Live' : 'Draft'}</span>
                        <span className="text-[10px] text-slate-600">{new Date(update.published_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                      </div>
                      <p className="text-sm font-medium text-slate-200 line-clamp-1">{update.title}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{update.category}</p>
                    </button>
                  ))}
                  {sortedUpdates.length === 0 && (
                    <div className="px-4 py-8 text-center text-xs text-slate-600">No updates yet.</div>
                  )}
                </div>
              </div>

              {/* Editor */}
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-xs text-slate-600 uppercase tracking-widest mb-0.5">{updateForm.id ? `Editing · #${updateForm.id}` : 'New post'}</p>
                    <h3 className="text-base font-bold text-white">{updateForm.title || 'Untitled'}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {updateForm.id && (
                      <button
                        onClick={deleteUpdate}
                        disabled={deletingUpdate}
                        className="flex items-center gap-1.5 text-xs font-semibold text-red-400 bg-red-500/8 hover:bg-red-500/15 border border-red-500/15 hover:border-red-500/25 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        {deletingUpdate ? 'Deleting…' : 'Delete'}
                      </button>
                    )}
                    <button
                      onClick={saveUpdate}
                      disabled={savingUpdate}
                      className="flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      {savingUpdate ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 mb-4">
                  {[
                    { label: 'Title', key: 'title' as const, type: 'text' },
                    { label: 'Slug', key: 'slug' as const, type: 'text' },
                    { label: 'Category', key: 'category' as const, type: 'text' },
                    { label: 'Image path', key: 'image' as const, type: 'text' },
                  ].map((f) => (
                    <div key={f.key}>
                      <label className="block text-xs font-medium text-slate-500 mb-1.5">{f.label}</label>
                      <input
                        value={updateForm[f.key] as string}
                        onChange={(e) => setUpdateField(f.key, e.target.value)}
                        className="w-full bg-[#0e0d17] border border-white/[0.07] focus:border-emerald-500/40 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none transition-colors"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Publish Date (UTC)</label>
                    <input
                      type="datetime-local"
                      value={updateForm.publishedAtISO}
                      onChange={(e) => setUpdateField('publishedAtISO', e.target.value)}
                      className="w-full bg-[#0e0d17] border border-white/[0.07] focus:border-emerald-500/40 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none transition-colors"
                    />
                  </div>
                  <div className="flex items-center">
                    <label className="flex items-center gap-3 cursor-pointer mt-4">
                      <div
                        onClick={() => setUpdateField('isPublished', !updateForm.isPublished)}
                        className={`w-9 h-5 rounded-full border transition-all cursor-pointer relative ${
                          updateForm.isPublished ? 'bg-emerald-600 border-emerald-500' : 'bg-white/[0.06] border-white/[0.1]'
                        }`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${updateForm.isPublished ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </div>
                      <span className="text-xs font-medium text-slate-400">{updateForm.isPublished ? 'Published' : 'Draft'}</span>
                    </label>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Summary</label>
                  <textarea
                    value={updateForm.summary}
                    onChange={(e) => setUpdateField('summary', e.target.value)}
                    rows={2}
                    className="w-full bg-[#0e0d17] border border-white/[0.07] focus:border-emerald-500/40 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none transition-colors resize-none"
                  />
                </div>

                <div className="grid lg:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Markdown</label>
                    <textarea
                      value={updateForm.markdown}
                      onChange={(e) => setUpdateField('markdown', e.target.value)}
                      rows={16}
                      className="w-full bg-[#0e0d17] border border-white/[0.07] focus:border-emerald-500/40 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none transition-colors font-mono resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Preview</label>
                    <div className="bg-[#0e0d17] border border-white/[0.07] rounded-xl px-4 py-3 h-[calc(100%-28px)] overflow-y-auto text-sm text-slate-200">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          h2: ({ children }) => <h2 className="mt-4 mb-2 text-base font-bold text-emerald-300">{children}</h2>,
                          h3: ({ children }) => <h3 className="mt-3 mb-1 text-sm font-bold text-emerald-200">{children}</h3>,
                          p: ({ children }) => <p className="mb-2 text-slate-300 leading-relaxed">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc pl-5 space-y-1 mb-2">{children}</ul>,
                          li: ({ children }) => <li className="text-slate-300">{children}</li>,
                          strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
                        }}
                      >
                        {updateForm.markdown}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          </div>{/* end tab content card */}
        </div>{/* end page content */}
      </div>{/* end main column */}
    </div>{/* end root flex */}

    {/* ── Player detail panel ────────────────────────────────────────── */}
    {selectedPlayer && (
      <>
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedPlayer(null)} />
        <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-[420px] bg-[#0e0d17] border-l border-white/[0.06] shadow-2xl flex flex-col overflow-y-auto">

          {/* Panel header */}
          <div className="flex items-start justify-between px-6 py-5 border-b border-white/[0.06]">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-1">Player Profile</p>
              <h2 className="text-xl font-extrabold text-white tracking-tight">{selectedPlayer.display_name}</h2>
              <p className="text-xs text-slate-600 font-mono mt-0.5">{selectedPlayer.username}</p>
            </div>
            <button onClick={() => setSelectedPlayer(null)} className="mt-0.5 w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 p-5 border-b border-white/[0.04]">
            {[
              { label: 'Game Mode', value: getGameMode(selectedPlayer.game_mode).label, accent: getGameMode(selectedPlayer.game_mode).color },
              { label: 'Total Level', value: selectedPlayer.total_level > 0 ? formatNumber(selectedPlayer.total_level) : '—', accent: 'text-slate-200' },
              { label: 'Overall Rank', value: selectedPlayer.overall_rank > 0 ? `#${formatNumber(selectedPlayer.overall_rank)}` : '—', accent: 'text-slate-300' },
              { label: 'Last Seen', value: timeAgo(selectedPlayer.last_fetched_at), accent: 'text-slate-400' },
              { label: 'Claimed', value: selectedPlayer.claimed_by ? '✓ Yes' : 'No', accent: selectedPlayer.claimed_by ? 'text-emerald-400' : 'text-slate-600' },
              { label: 'Claimed At', value: selectedPlayer.claimed_at ? new Date(selectedPlayer.claimed_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—', accent: 'text-slate-500' },
            ].map((s) => (
              <div key={s.label} className="bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-3">
                <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-1.5">{s.label}</p>
                <p className={`text-sm font-bold ${s.accent}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div className="px-5 py-4 flex gap-2 border-b border-white/[0.04]">
            <Link
              href={`/player/${encodeURIComponent(selectedPlayer.username)}`}
              target="_blank"
              className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 px-3 py-2 rounded-xl transition-all"
            >
              View Profile
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </Link>
            {selectedPlayer.claimed_by && (
              <button
                onClick={async () => { await unclaim(selectedPlayer.username); setSelectedPlayer(null); }}
                className="flex items-center gap-1.5 text-xs font-semibold text-red-400 bg-red-500/8 hover:bg-red-500/15 border border-red-500/15 hover:border-red-500/25 px-3 py-2 rounded-xl transition-all"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                Unclaim
              </button>
            )}
          </div>

          {/* Action log */}
          <div className="flex-1 px-5 py-5">
            <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-4">Admin Action History</p>
            {loadingLog ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-14 rounded-xl bg-white/[0.03] animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
                ))}
              </div>
            ) : playerLog.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-10 h-10 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-3">
                  <svg className="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <p className="text-xs text-slate-600">No actions recorded yet.</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-[7px] top-0 bottom-0 w-px bg-white/[0.04]" />
                <div className="space-y-4">
                  {playerLog.map((entry) => (
                    <div key={entry.id} className="flex gap-3">
                      <div className="w-3.5 h-3.5 mt-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 shrink-0 relative z-10" />
                      <div className="flex-1 bg-white/[0.02] border border-white/[0.04] rounded-xl px-3.5 py-3">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-semibold text-emerald-400 capitalize">{entry.action.replace(/_/g, ' ')}</span>
                          <span className="text-[10px] text-slate-700 shrink-0">{timeAgo(entry.created_at)}</span>
                        </div>
                        {entry.detail && <p className="text-xs text-slate-400 mb-0.5">{entry.detail}</p>}
                        {entry.admin_email && <p className="text-[10px] text-slate-700">by {entry.admin_email}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </aside>
      </>
    )}
    </>
  );
}
