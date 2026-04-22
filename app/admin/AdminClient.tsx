'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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

interface Props {
  players: Player[];
  userProfiles: UserProfile[];
  groups: Group[];
}

export default function AdminClient({ players, userProfiles, groups }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<'players' | 'users' | 'groups'>('players');
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [updatingMode, setUpdatingMode] = useState<string | null>(null);
  const [togglingGroup, setTogglingGroup] = useState<string | null>(null);


  const filtered = players.filter(p =>
    p.username.includes(search.toLowerCase()) ||
    p.display_name.toLowerCase().includes(search.toLowerCase())
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
    setMsg({ type: 'ok', text: `Updated ${username} → ${mode}` });
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
    setMsg({ type: 'ok', text: `Admin status updated.` });
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

  return (
    <main className="flex-1 max-w-6xl mx-auto px-4 py-10 w-full animate-fade-up">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white mb-1">Admin Panel</h1>
          <p className="text-slate-400 text-sm">{players.length} players · {userProfiles.length} accounts</p>
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

      {/* Tabs */}
      <div className="flex gap-1 bg-[#1e1c2a] border border-white/[0.07] rounded-xl p-1 mb-6 w-fit">
        {(['players', 'users', 'groups'] as const).map(t => (
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
            placeholder="Search players…"
            value={search}
            onChange={e => setSearch(e.target.value)}
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
                {filtered.map(p => {
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
                          onChange={e => overrideGameMode(p.username, e.target.value as GameModeKey)}
                          className="bg-[#17151f] border border-white/[0.08] rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50 disabled:opacity-50"
                        >
                          {GAME_MODES.map(m => (
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
              {userProfiles.map(u => (
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
              {groups.map(g => (
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
    </main>
  );
}
