'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { GAME_MODES, getGameMode, GameModeKey, formatNumber } from '@/lib/osrs';

interface Props {
  user: { id: string; email: string };
  claimedPlayer: {
    username: string;
    display_name: string;
    game_mode: string;
    total_level: number;
    total_xp: number;
    overall_rank: number;
    claimed_at: string | null;
  } | null;
  isAdmin: boolean;
}

export default function AccountClient({ user, claimedPlayer, isAdmin }: Props) {
  const router = useRouter();
  const [claimInput, setClaimInput] = useState('');
  const [selectedMode, setSelectedMode] = useState<GameModeKey>(
    (claimedPlayer?.game_mode as GameModeKey) ?? 'regular'
  );
  const [claimLoading, setClaimLoading] = useState(false);
  const [modeLoading, setModeLoading] = useState(false);
  const [unclaimLoading, setUnclaimLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  async function handleClaim(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setClaimLoading(true);
    const res = await fetch('/api/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: claimInput.trim(), game_mode: selectedMode }),
    });
    const json = await res.json();
    setClaimLoading(false);
    if (!res.ok) { setMsg({ type: 'err', text: json.error }); return; }
    setMsg({ type: 'ok', text: `Profile "${json.username}" claimed!` });
    router.refresh();
  }

  async function handleModeChange(mode: GameModeKey) {
    setSelectedMode(mode);
    setMsg(null);
    setModeLoading(true);
    const res = await fetch('/api/gamemode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_mode: mode }),
    });
    const json = await res.json();
    setModeLoading(false);
    if (!res.ok) { setMsg({ type: 'err', text: json.error }); return; }
    setMsg({ type: 'ok', text: 'Game mode updated.' });
    router.refresh();
  }

  async function handleUnclaim() {
    if (!confirm(`Unlink "${claimedPlayer?.display_name}" from your account?`)) return;
    setMsg(null);
    setUnclaimLoading(true);
    const res = await fetch('/api/unclaim', { method: 'POST' });
    const json = await res.json();
    setUnclaimLoading(false);
    if (!res.ok) { setMsg({ type: 'err', text: json.error }); return; }
    setMsg({ type: 'ok', text: 'Profile unlinked.' });
    router.refresh();
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  const gm = getGameMode(claimedPlayer?.game_mode ?? 'regular');

  return (
    <main className="flex-1 max-w-2xl mx-auto px-4 py-10 w-full animate-fade-up">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white mb-1">My Account</h1>
          <p className="text-slate-400 text-sm">{user.email}</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Link href="/admin" className="text-xs font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 px-3 py-1.5 rounded-lg transition-colors">
              Admin Panel
            </Link>
          )}
          <button onClick={handleSignOut} className="text-xs font-semibold bg-white/[0.05] border border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.08] px-3 py-1.5 rounded-lg transition-colors">
            Sign Out
          </button>
        </div>
      </div>

      {/* Status message */}
      {msg && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm border ${
          msg.type === 'ok'
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>{msg.text}</div>
      )}

      {/* Claimed profile card */}
      {claimedPlayer ? (
        <div className="bg-[#1e1c2a] border border-white/[0.07] rounded-2xl p-5 mb-6 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-900 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-emerald-900/40">
              {claimedPlayer.display_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-none">{claimedPlayer.display_name}</p>
              <span className={`text-xs font-semibold ${gm.color} flex items-center gap-1`}>{gm.emoji && <img src={gm.emoji} className="inline-block w-4 h-4" alt="" />}{gm.label}</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Link href={`/player/${encodeURIComponent(claimedPlayer.username)}`} className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
                View Profile →
              </Link>
              <button
                onClick={handleUnclaim}
                disabled={unclaimLoading}
                className="text-xs font-semibold bg-white/[0.04] border border-white/[0.08] text-slate-500 hover:text-red-400 hover:border-red-500/30 disabled:opacity-50 px-2.5 py-1 rounded-lg transition-colors"
              >
                {unclaimLoading ? 'Unlinking…' : 'Unlink'}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center mb-5">
            <div className="bg-[#17151f] rounded-lg px-3 py-2">
              <p className="text-lg font-extrabold text-white">{formatNumber(claimedPlayer.total_level)}</p>
              <p className="text-xs text-slate-500">Total Level</p>
            </div>
            <div className="bg-[#17151f] rounded-lg px-3 py-2">
              <p className="text-lg font-extrabold text-white">{claimedPlayer.overall_rank > 0 ? `#${formatNumber(claimedPlayer.overall_rank)}` : '—'}</p>
              <p className="text-xs text-slate-500">Server Rank</p>
            </div>
            <div className="bg-[#17151f] rounded-lg px-3 py-2">
              <p className="text-lg font-extrabold text-white">{gm.combatXp}x / {gm.skillingXp}x</p>
              <p className="text-xs text-slate-500">XP Rates</p>
            </div>
          </div>

          {/* Game mode selector */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
              Game Mode {modeLoading && <span className="text-slate-600">(saving…)</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              {GAME_MODES.map(m => (
                <button
                  key={m.key}
                  onClick={() => handleModeChange(m.key)}
                  disabled={modeLoading}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    selectedMode === m.key
                      ? 'bg-emerald-600/30 border-emerald-500/50 text-white'
                      : 'bg-[#17151f] border-white/[0.06] text-slate-400 hover:border-white/20 hover:text-slate-200'
                  }`}
                >
                  {m.emoji && <img src={m.emoji} className="inline-block w-4 h-4 mr-1" alt="" />}{m.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-600 mt-2">
              {gm.combatXp}x Combat · {gm.skillingXp}x Skilling
            </p>
          </div>
        </div>
      ) : (
        /* Claim form */
        <div className="bg-[#1e1c2a] border border-white/[0.07] rounded-2xl p-5 mb-6 shadow-xl">
          <h2 className="text-sm font-bold text-white mb-1">Claim Your Profile</h2>
          <p className="text-xs text-slate-500 mb-4">
            Link your Ferox.ps username to this account to set your game mode badge.
            The player must have been searched on FeroxStats at least once.
          </p>
          <form onSubmit={handleClaim} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Your In-game Name</label>
              <input
                type="text" required value={claimInput} onChange={e => setClaimInput(e.target.value)}
                placeholder="e.g. Hexae"
                className="w-full bg-[#17151f] border border-white/[0.08] rounded-lg px-3 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Game Mode</label>
              <div className="flex flex-wrap gap-2">
                {GAME_MODES.map(m => (
                  <button
                    key={m.key} type="button"
                    onClick={() => setSelectedMode(m.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      selectedMode === m.key
                        ? 'bg-emerald-600/30 border-emerald-500/50 text-white'
                        : 'bg-[#17151f] border-white/[0.06] text-slate-400 hover:border-white/20 hover:text-slate-200'
                    }`}
                  >
                    {m.emoji && <img src={m.emoji} className="inline-block w-4 h-4 mr-1" alt="" />}{m.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-600 mt-2">
                Selected: {getGameMode(selectedMode).combatXp}x Combat · {getGameMode(selectedMode).skillingXp}x Skilling
              </p>
            </div>
            <button
              type="submit" disabled={claimLoading}
              className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg transition-all shadow-lg shadow-emerald-900/30 text-sm"
            >
              {claimLoading ? 'Claiming…' : 'Claim Profile'}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
