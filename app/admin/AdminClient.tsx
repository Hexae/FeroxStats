'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getGameMode, GAME_MODES, GameModeKey, formatNumber } from '@/lib/osrs';

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

export default function AdminClient({ players, userProfiles, groups, updates }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('players');
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [updatingMode, setUpdatingMode] = useState<string | null>(null);
  const [togglingGroup, setTogglingGroup] = useState<string | null>(null);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [deletingUpdate, setDeletingUpdate] = useState(false);
  const [updateForm, setUpdateForm] = useState<UpdateForm>(createEmptyForm());

  const filtered = players.filter((p) =>
    p.username.includes(search.toLowerCase()) ||
    p.display_name.toLowerCase().includes(search.toLowerCase()),
  );

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

  return (
    <main className="flex-1 max-w-6xl mx-auto px-4 py-10 w-full animate-fade-up">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white mb-1">Admin Panel</h1>
          <p className="text-slate-400 text-sm">{players.length} players · {userProfiles.length} accounts · {updates.length} updates</p>
        </div>
        <Link href="/account" className="text-xs font-semibold bg-white/[0.05] border border-white/[0.08] text-slate-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors">
          ← Account
        </Link>
      </div>

      {msg && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm border ${
          msg.type === 'ok' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>{msg.text}</div>
      )}

      <div className="flex gap-1 bg-[#1e1c2a] border border-white/[0.07] rounded-xl p-1 mb-6 w-fit">
        {(['players', 'users', 'groups', 'updates'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold capitalize transition-all ${
              tab === t ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >{t}</button>
        ))}
      </div>

      {tab === 'players' && (
        <>
          <input
            type="text"
            placeholder="Search players..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full mb-4 bg-[#1e1c2a] border border-white/[0.07] rounded-lg px-3 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 text-sm"
          />
          <div className="bg-[#1e1c2a] border border-white/[0.07] rounded-2xl overflow-hidden shadow-2xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.05] bg-[#17151f]">
                  <th className="py-3 px-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Player</th>
                  <th className="py-3 px-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Game Mode</th>
                  <th className="py-3 px-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Rank</th>
                  <th className="py-3 px-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Claimed</th>
                  <th className="py-3 px-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const gm = getGameMode(p.game_mode);
                  return (
                    <tr key={p.username} className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02]">
                      <td className="py-3 px-4">
                        <Link href={`/player/${encodeURIComponent(p.username)}`} className="font-semibold text-slate-200 hover:text-emerald-400 transition-colors">
                          {p.display_name}
                        </Link>
                        <p className="text-xs text-slate-600">{p.username}</p>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={p.game_mode}
                          disabled={updatingMode === p.username}
                          onChange={(e) => overrideGameMode(p.username, e.target.value as GameModeKey)}
                          className="bg-[#17151f] border border-white/[0.08] rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50 disabled:opacity-50"
                        >
                          {GAME_MODES.map((m) => (
                            <option key={m.key} value={m.key}>{m.label}</option>
                          ))}
                        </select>
                        <span className={`ml-2 text-xs ${gm.color}`}>{gm.combatXp}x/{gm.skillingXp}x</span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-xs font-mono">
                        {p.overall_rank > 0 ? `#${formatNumber(p.overall_rank)}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {p.claimed_by ? (
                          <span className="text-green-400 font-medium">✓ Claimed</span>
                        ) : (
                          <span className="text-slate-600">Unclaimed</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {p.claimed_by && (
                          <button
                            onClick={() => unclaim(p.username)}
                            className="text-xs text-red-500 hover:text-red-300 font-medium transition-colors"
                          >
                            Unclaim
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-600 text-sm">No players found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'users' && (
        <div className="bg-[#1e1c2a] border border-white/[0.07] rounded-2xl overflow-hidden shadow-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.05] bg-[#17151f]">
                <th className="py-3 px-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Email</th>
                <th className="py-3 px-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Joined</th>
                <th className="py-3 px-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Admin</th>
              </tr>
            </thead>
            <tbody>
              {userProfiles.map((u) => (
                <tr key={u.id} className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02]">
                  <td className="py-3 px-4 text-slate-200 text-sm">{u.email}</td>
                  <td className="py-3 px-4 text-slate-500 text-xs">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => toggleAdmin(u.id, u.is_admin)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                        u.is_admin
                          ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 hover:bg-amber-500/10'
                          : 'bg-white/[0.04] border-white/[0.08] text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {u.is_admin ? 'Admin ✓' : 'Make Admin'}
                    </button>
                  </td>
                </tr>
              ))}
              {userProfiles.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-10 text-center text-slate-600 text-sm">No users yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'groups' && (
        <div className="bg-[#1e1c2a] border border-white/[0.07] rounded-2xl overflow-hidden shadow-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.05] bg-[#17151f]">
                <th className="py-3 px-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Group</th>
                <th className="py-3 px-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Members</th>
                <th className="py-3 px-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Created</th>
                <th className="py-3 px-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Discord Verified</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id} className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02]">
                  <td className="py-3 px-4">
                    <Link href={`/groups/${g.slug}`} className="font-semibold text-slate-200 hover:text-emerald-400 transition-colors">
                      {g.name}
                    </Link>
                    <p className="text-xs text-slate-600">{g.slug}</p>
                  </td>
                  <td className="py-3 px-4 text-slate-400 text-xs">{g.members_count}</td>
                  <td className="py-3 px-4 text-slate-500 text-xs">
                    {g.created_at ? new Date(g.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      disabled={togglingGroup === g.id}
                      onClick={() => toggleVerified(g.id, !!g.discord_verified)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all disabled:opacity-50 ${
                        g.discord_verified
                          ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10'
                          : 'bg-white/[0.04] border-white/[0.08] text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {g.discord_verified ? 'Verified ✓' : 'Verify'}
                    </button>
                  </td>
                </tr>
              ))}
              {groups.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-slate-600 text-sm">No groups yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'updates' && (
        <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
          <div className="rounded-2xl border border-white/[0.07] bg-[#1e1c2a] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">Published + Draft</h3>
              <button
                onClick={startNewUpdate}
                className="rounded-lg border border-emerald-900/40 bg-emerald-950/30 px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-900/30"
              >
                New
              </button>
            </div>
            <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
              {sortedUpdates.map((update) => (
                <button
                  key={update.id}
                  onClick={() => pickUpdate(update)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    updateForm.id === update.id
                      ? 'border-emerald-800/70 bg-emerald-900/25'
                      : 'border-white/[0.08] bg-[#17151f] hover:border-emerald-900/30'
                  }`}
                >
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">{new Date(update.published_at).toLocaleDateString()} · {update.is_published ? 'Published' : 'Draft'}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-100 line-clamp-2">{update.title}</p>
                </button>
              ))}
              {sortedUpdates.length === 0 && (
                <p className="rounded-lg border border-white/[0.08] bg-[#17151f] p-3 text-xs text-slate-500">No updates yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-[#1e1c2a] p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-white">{updateForm.id ? `Editing #${updateForm.id}` : 'Create New Update'}</h3>
              <div className="flex gap-2">
                <button
                  onClick={saveUpdate}
                  disabled={savingUpdate}
                  className="rounded-lg border border-emerald-900/40 bg-emerald-950/30 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-900/30 disabled:opacity-60"
                >
                  {savingUpdate ? 'Saving...' : 'Save'}
                </button>
                {updateForm.id && (
                  <button
                    onClick={deleteUpdate}
                    disabled={deletingUpdate}
                    className="rounded-lg border border-red-900/40 bg-red-950/30 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-900/30 disabled:opacity-60"
                  >
                    {deletingUpdate ? 'Deleting...' : 'Delete'}
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-slate-400">Title
                <input value={updateForm.title} onChange={(e) => setUpdateField('title', e.target.value)} className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#17151f] px-3 py-2 text-sm text-slate-100" />
              </label>
              <label className="text-xs text-slate-400">Slug
                <input value={updateForm.slug} onChange={(e) => setUpdateField('slug', e.target.value)} className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#17151f] px-3 py-2 text-sm text-slate-100" />
              </label>
              <label className="text-xs text-slate-400">Category
                <input value={updateForm.category} onChange={(e) => setUpdateField('category', e.target.value)} className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#17151f] px-3 py-2 text-sm text-slate-100" />
              </label>
              <label className="text-xs text-slate-400">Image
                <input value={updateForm.image} onChange={(e) => setUpdateField('image', e.target.value)} className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#17151f] px-3 py-2 text-sm text-slate-100" />
              </label>
              <label className="text-xs text-slate-400">Publish Date (UTC)
                <input type="datetime-local" value={updateForm.publishedAtISO} onChange={(e) => setUpdateField('publishedAtISO', e.target.value)} className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#17151f] px-3 py-2 text-sm text-slate-100" />
              </label>
              <label className="text-xs text-slate-400 flex items-center gap-2 pt-6">
                <input type="checkbox" checked={updateForm.isPublished} onChange={(e) => setUpdateField('isPublished', e.target.checked)} />
                Published
              </label>
            </div>

            <label className="mt-3 block text-xs text-slate-400">Summary
              <textarea value={updateForm.summary} onChange={(e) => setUpdateField('summary', e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#17151f] px-3 py-2 text-sm text-slate-100" />
            </label>

            <label className="mt-3 block text-xs text-slate-400">Markdown Changelog
              <textarea value={updateForm.markdown} onChange={(e) => setUpdateField('markdown', e.target.value)} rows={14} className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#17151f] px-3 py-2 text-sm text-slate-100 font-mono" />
            </label>

            <div className="mt-5 rounded-xl border border-white/[0.08] bg-[#17151f] p-4">
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Live Preview</h4>
              <div className="space-y-2 text-sm text-slate-200">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h2: ({ children }) => <h2 className="mt-5 text-base font-bold text-emerald-300">{children}</h2>,
                    h3: ({ children }) => <h3 className="mt-4 text-sm font-bold text-emerald-200">{children}</h3>,
                    p: ({ children }) => <p>{children}</p>,
                    ul: ({ children }) => <ul className="list-disc pl-5 space-y-1">{children}</ul>,
                    li: ({ children }) => <li>{children}</li>,
                    strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
                  }}
                >
                  {updateForm.markdown}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
