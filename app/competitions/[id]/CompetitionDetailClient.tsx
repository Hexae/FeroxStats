'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { formatXp, getSkillIcon, SKILLS } from '@/lib/osrs';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, TimeScale,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, TimeScale);

// ─── Animation keyframes (injected via <style>) ───────────────────────────────
const ANIMATION_CSS = `
  @keyframes rankUp   { from { background-color: rgba(16,185,129,0.22); } to { background-color: transparent; } }
  @keyframes rankDown { from { background-color: rgba(239,68,68,0.18);  } to { background-color: transparent; } }
  @keyframes xpGlow   { 0%,100% { opacity:1; filter:none; } 50% { opacity:.85; filter:drop-shadow(0 0 8px rgba(52,211,153,.7)); } }
  @keyframes confettiFall { 0% { transform:translateY(-20px) rotate(0deg) scale(1); opacity:1; } 100% { transform:translateY(110vh) rotate(720deg) scale(0.3); opacity:0; } }
`;

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface Standing {
  username: string;
  display_name: string;
  xp_gained: number;
  start_xp: number;
  end_xp: number;
  last_updated_at: string | null;
}

interface RankChange {
  username: string;
  display_name: string;
  prevRank: number;
  currRank: number;
  at: Date;
}

interface ChartSeries {
  username: string;
  display_name: string;
  points: { t: string; xp_gained: number }[];
}

interface CompetitionDetail {
  id: string;
  name: string;
  metric: string;
  starts_at: string;
  ends_at: string;
  group_id: string;
  group_name: string;
  group_slug: string;
  group_description: string | null;
  participant_count: number;
  status: 'active' | 'upcoming' | 'ended';
  progress_pct: number;
  total_gained: number;
  standings: Standing[];
  chart_data: ChartSeries[];
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ─── Constants ────────────────────────────────────────────────────────────────
const METRIC_EMOJI: Record<string, string> = {
  overall: '⚔️', attack: '🗡️', defence: '🛡️', strength: '💪', hitpoints: '❤️',
  ranged: '🏹', prayer: '🙏', magic: '🔮', cooking: '🍳', woodcutting: '🪓',
  fletching: '🪃', fishing: '🎣', firemaking: '🔥', crafting: '⚒️', smithing: '🔨',
  mining: '⛏️', herblore: '🌿', agility: '🏃', thieving: '🗝️', slayer: '💀',
  farming: '🌾', runecraft: '✨', hunter: '🦅', construction: '🏠',
};

const SKILL_BG_IMAGE: Record<string, string> = {
  overall:      'https://oldschool.runescape.wiki/images/thumb/Lumbridge.png/800px-Lumbridge.png',
  attack:       'https://oldschool.runescape.wiki/images/thumb/Warriors%27_Guild_bank.png/800px-Warriors%27_Guild_bank.png',
  defence:      'https://oldschool.runescape.wiki/images/thumb/Warriors%27_Guild_bank.png/800px-Warriors%27_Guild_bank.png',
  strength:     'https://oldschool.runescape.wiki/images/thumb/Warriors%27_Guild_bank.png/800px-Warriors%27_Guild_bank.png',
  hitpoints:    'https://oldschool.runescape.wiki/images/thumb/Lumbridge.png/800px-Lumbridge.png',
  ranged:       'https://oldschool.runescape.wiki/images/thumb/Ranging_Guild.png/800px-Ranging_Guild.png',
  prayer:       'https://oldschool.runescape.wiki/images/thumb/Edgeville_Monastery.png/800px-Edgeville_Monastery.png',
  magic:        'https://oldschool.runescape.wiki/images/thumb/Wizard%27s_Tower.png/800px-Wizard%27s_Tower.png',
  cooking:      'https://oldschool.runescape.wiki/images/thumb/Cooking_Guild.png/800px-Cooking_Guild.png',
  woodcutting:  'https://oldschool.runescape.wiki/images/thumb/Woodcutting_Guild.png/800px-Woodcutting_Guild.png',
  fletching:    'https://oldschool.runescape.wiki/images/thumb/Ranging_Guild.png/800px-Ranging_Guild.png',
  fishing:      'https://oldschool.runescape.wiki/images/thumb/Fishing_Guild.png/800px-Fishing_Guild.png',
  firemaking:   'https://oldschool.runescape.wiki/images/thumb/Wintertodt.png/800px-Wintertodt.png',
  crafting:     'https://oldschool.runescape.wiki/images/thumb/Crafting_Guild.png/800px-Crafting_Guild.png',
  smithing:     'https://oldschool.runescape.wiki/images/thumb/Blast_Furnace.png/800px-Blast_Furnace.png',
  mining:       'https://oldschool.runescape.wiki/images/thumb/Mining_Guild.png/800px-Mining_Guild.png',
  herblore:     'https://oldschool.runescape.wiki/images/thumb/Farming_Guild.png/800px-Farming_Guild.png',
  agility:      'https://oldschool.runescape.wiki/images/thumb/Gnome_Stronghold_Agility_Course.png/800px-Gnome_Stronghold_Agility_Course.png',
  thieving:     'https://oldschool.runescape.wiki/images/thumb/Rogues%27_Den.png/800px-Rogues%27_Den.png',
  slayer:       'https://oldschool.runescape.wiki/images/thumb/Catacombs_of_Kourend.png/800px-Catacombs_of_Kourend.png',
  farming:      'https://oldschool.runescape.wiki/images/thumb/Farming_Guild.png/800px-Farming_Guild.png',
  runecraft:    'https://oldschool.runescape.wiki/images/thumb/Abyss.png/800px-Abyss.png',
  hunter:       'https://oldschool.runescape.wiki/images/thumb/Piscatoris_Hunter_area.png/800px-Piscatoris_Hunter_area.png',
  construction: 'https://oldschool.runescape.wiki/images/thumb/Player-owned_house.png/800px-Player-owned_house.png',
};

const CHART_COLORS = ['rgb(74,144,226)','rgb(231,76,60)','rgb(241,196,15)','rgb(46,204,113)','rgb(155,89,182)'];

const MILESTONES = [
  { xp: 100_000,    label: '100K', color: 'text-slate-300 border-slate-500/40 bg-slate-500/10' },
  { xp: 500_000,    label: '500K', color: 'text-sky-300 border-sky-500/40 bg-sky-500/10' },
  { xp: 1_000_000,  label: '1M',   color: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10' },
  { xp: 5_000_000,  label: '5M',   color: 'text-amber-300 border-amber-500/40 bg-amber-500/10' },
  { xp: 10_000_000, label: '10M',  color: 'text-purple-300 border-purple-500/40 bg-purple-500/10' },
  { xp: 50_000_000, label: '50M',  color: 'text-rose-300 border-rose-500/40 bg-rose-500/10' },
];

const AVATAR_COLORS = ['bg-red-600','bg-orange-500','bg-amber-500','bg-emerald-600','bg-sky-600','bg-violet-600','bg-rose-600','bg-cyan-600'];

// ─── Utility functions ────────────────────────────────────────────────────────
function getMilestone(xp: number) {
  for (let i = MILESTONES.length - 1; i >= 0; i--) {
    if (xp >= MILESTONES[i].xp) return MILESTONES[i];
  }
  return null;
}

interface Achievement { icon: string; label: string; description: string; color: string; }

function getAchievements(standings: Standing[]): Map<string, Achievement[]> {
  const map = new Map<string, Achievement[]>();
  const add = (u: string, a: Achievement) => { if (!map.has(u)) map.set(u, []); map.get(u)!.push(a); };
  if (standings.length === 0) return map;
  const leader = standings[0];
  const total = standings.reduce((s, p) => s + p.xp_gained, 0);
  const avg = total / standings.length;
  if (leader.xp_gained > 0) add(leader.username, { icon: '👑', label: 'Leader', description: 'Currently in 1st place', color: 'text-amber-400' });
  standings.forEach((s) => {
    if (s.xp_gained >= 1_000_000)  add(s.username, { icon: '🚀', label: 'Million Club', description: 'Gained 1M+ XP', color: 'text-emerald-400' });
    if (s.xp_gained >= 10_000_000) add(s.username, { icon: '⚡', label: 'XP Machine',   description: 'Gained 10M+ XP', color: 'text-yellow-400' });
    if (avg > 0 && s.xp_gained > avg * 1.5) add(s.username, { icon: '📈', label: 'Overachiever', description: '50% above average', color: 'text-sky-400' });
  });
  const best = standings.filter((s) => s.start_xp > 0 && s.end_xp > s.start_xp)
    .sort((a, b) => (b.end_xp - b.start_xp) / b.start_xp - (a.end_xp - a.start_xp) / a.start_xp)[0];
  if (best) add(best.username, { icon: '🎯', label: 'Consistent', description: 'Best relative gain', color: 'text-violet-400' });
  return map;
}

function getMomentumIcon(rank: number, xp: number, maxXp: number): string {
  if (xp <= 0) return '';
  const pct = xp / maxXp;
  if (rank === 1) return '🔥';
  if (pct > 0.9) return '⚡';
  if (pct > 0.6) return '📈';
  if (pct > 0.3) return '➡️';
  return '📉';
}

function predictedFinalXp(xpGained: number, pct: number): number | null {
  if (pct <= 0 || pct >= 100) return null;
  return Math.round((xpGained / pct) * 100);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Rank change tracker hook ─────────────────────────────────────────────────
function useRankChanges(standings: Standing[], enabled: boolean) {
  const prevMapRef = useRef<Map<string, number>>(new Map());
  const initRef = useRef(false);
  const [recentChanges, setRecentChanges] = useState<RankChange[]>([]);
  const [changeCount, setChangeCount] = useState(0);
  const [flashMap, setFlashMap] = useState<Map<string, 'up' | 'down'>>(new Map());

  useEffect(() => {
    if (!enabled || standings.length === 0) return;
    if (!initRef.current) {
      initRef.current = true;
      standings.forEach((s, i) => prevMapRef.current.set(s.username, i + 1));
      return;
    }
    const newChanges: RankChange[] = [];
    const flash = new Map<string, 'up' | 'down'>();
    standings.forEach((s, i) => {
      const prev = prevMapRef.current.get(s.username);
      const curr = i + 1;
      if (prev !== undefined && prev !== curr) {
        const dir: 'up' | 'down' = curr < prev ? 'up' : 'down';
        newChanges.push({ username: s.username, display_name: s.display_name, prevRank: prev, currRank: curr, at: new Date() });
        flash.set(s.username, dir);
      }
      prevMapRef.current.set(s.username, curr);
    });
    if (newChanges.length > 0) {
      setRecentChanges((prev) => [...newChanges, ...prev].slice(0, 8));
      setChangeCount((n) => n + newChanges.length);
      setFlashMap(flash);
      const tid = window.setTimeout(() => setFlashMap(new Map()), 2500);
      return () => window.clearTimeout(tid);
    }
  }, [standings, enabled]);

  const resetCount = useCallback(() => setChangeCount(0), []);
  return { recentChanges, changeCount, flashMap, resetCount };
}

// ─── Countdown ────────────────────────────────────────────────────────────────
function useCountdown(targetDateStr: string) {
  const [rem, setRem] = useState(() => Math.max(0, new Date(targetDateStr).getTime() - Date.now()));
  useEffect(() => {
    const id = setInterval(() => setRem(Math.max(0, new Date(targetDateStr).getTime() - Date.now())), 1000);
    return () => clearInterval(id);
  }, [targetDateStr]);
  const s = Math.floor(rem / 1000);
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), mins: Math.floor((s % 3600) / 60), secs: s % 60 };
}

function CountdownTimer({ targetAt }: { targetAt: string }) {
  const { days, hours, mins, secs } = useCountdown(targetAt);
  return (
    <div className="flex items-end gap-2">
      {[{ v: days, l: 'days' }, { v: hours, l: 'hrs' }, { v: mins, l: 'min' }, { v: secs, l: 'sec' }].map(({ v, l }) => (
        <div key={l} className="text-center">
          <div className="text-xl font-bold tabular-nums leading-none text-white">{String(v).padStart(2, '0')}</div>
          <div className="text-[9px] uppercase tracking-widest text-slate-500 mt-0.5">{l}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Player avatar (letter-based, deterministic color) ────────────────────────
function PlayerAvatar({ username }: { username: string }) {
  const bg = AVATAR_COLORS[username.charCodeAt(0) % AVATAR_COLORS.length];
  return (
    <div className={`h-8 w-8 rounded-full ${bg} flex items-center justify-center text-xs font-bold text-white shrink-0 border border-white/10 select-none`}>
      {username.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── SVG donut chart ──────────────────────────────────────────────────────────
function DonutChart({ pct, color, size = 44 }: { pct: number; color: string; size?: number }) {
  const r = size / 2 - 4;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(Math.max(pct, 0), 100) / 100 * circ;
  const c = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={c} cy={c} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4" />
      <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
        style={{ transform: `rotate(-90deg)`, transformOrigin: `${c}px ${c}px`, transition: 'stroke-dasharray 0.7s' }} />
      <text x={c} y={c + 4} textAnchor="middle" fill="white" style={{ fontSize: '9px', fontWeight: '700' }}>
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

// ─── Confetti burst ───────────────────────────────────────────────────────────
function ConfettiBurst({ trigger }: { trigger: boolean }) {
  type Particle = { id: number; x: number; color: string; delay: number; dur: number; size: number };
  const [particles, setParticles] = useState<Particle[]>([]);
  const firedRef = useRef(false);
  useEffect(() => {
    if (!trigger || firedRef.current) return;
    firedRef.current = true;
    const colors = ['#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444','#ec4899','#f97316','#06b6d4'];
    const ps: Particle[] = Array.from({ length: 45 }, (_, i) => ({
      id: i, x: 10 + Math.random() * 80,
      color: colors[i % colors.length],
      delay: Math.random() * 0.7, dur: 1.2 + Math.random() * 0.9,
      size: 6 + Math.random() * 7,
    }));
    setParticles(ps);
    const tid = window.setTimeout(() => setParticles([]), 2800);
    return () => window.clearTimeout(tid);
  }, [trigger]);
  if (particles.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      {particles.map((p) => (
        <div key={p.id} className="absolute top-0 rounded-sm"
          style={{ left: `${p.x}%`, width: p.size, height: p.size, backgroundColor: p.color,
            animation: `confettiFall ${p.dur}s ${p.delay}s ease-in forwards` }} />
      ))}
    </div>
  );
}

// ─── Stat card with hover tooltip ─────────────────────────────────────────────
function StatCard({ children, tooltip, className = '' }: { children: React.ReactNode; tooltip?: string; className?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className={`relative rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-5 hover:border-white/[0.12] transition-all ${className}`}
      onMouseEnter={() => tooltip && setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {tooltip && show && (
        <div className="absolute left-1/2 bottom-full -translate-x-1/2 mb-2 z-30 pointer-events-none">
          <div className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 whitespace-nowrap shadow-2xl">
            {tooltip}
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
        </div>
      )}
    </div>
  );
}

// ─── Live activity feed ───────────────────────────────────────────────────────
function LiveActivityFeed({ changes }: { changes: RankChange[] }) {
  if (changes.length === 0) return null;
  return (
    <div className="px-5 py-3 border-b border-white/[0.06] bg-emerald-500/[0.02]">
      <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2">Live rank changes</p>
      <div className="space-y-1.5">
        {changes.slice(0, 4).map((c) => (
          <div key={`${c.username}-${c.at.getTime()}`} className="flex items-center gap-2 text-xs">
            <span className={`font-bold ${c.currRank < c.prevRank ? 'text-emerald-400' : 'text-red-400'}`}>
              {c.currRank < c.prevRank ? '↑' : '↓'}
            </span>
            <Link href={`/player/${c.username}`} className="font-semibold text-slate-300 hover:text-white transition-colors truncate">
              {c.display_name}
            </Link>
            <span className="text-slate-600">#{c.prevRank} →</span>
            <span className={`font-semibold ${c.currRank < c.prevRank ? 'text-emerald-400' : 'text-red-400'}`}>#{c.currRank}</span>
            <span className="text-slate-700 ml-auto shrink-0">{c.at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Stats grid ───────────────────────────────────────────────────────────────
function StatsGrid({ comp }: { comp: CompetitionDetail }) {
  const totalXp = comp.total_gained ?? 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">

      {/* Countdown */}
      <StatCard tooltip={comp.status === 'active' ? 'Time left until competition ends' : comp.status === 'upcoming' ? 'Time until the competition begins' : 'Competition has ended'}>
        <div className="flex items-start justify-between mb-4">
          <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold">
            {comp.status === 'active' ? 'Time Remaining' : comp.status === 'upcoming' ? 'Starts In' : 'Completed'}
          </p>
          <span className="text-xl">{comp.status === 'active' ? '⏳' : '🎯'}</span>
        </div>
        {comp.status === 'ended' ? (
          <p className="text-sm text-slate-400">{formatDate(comp.ends_at)}</p>
        ) : (
          <CountdownTimer targetAt={comp.status === 'active' ? comp.ends_at : comp.starts_at} />
        )}
      </StatCard>

      {/* Total Gained */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] hover:border-white/[0.12] transition-all">
        {SKILL_BG_IMAGE[comp.metric.toLowerCase()] && (
          <div className="absolute inset-0 bg-cover bg-center opacity-30"
            style={{ backgroundImage: `url(${SKILL_BG_IMAGE[comp.metric.toLowerCase()]})` }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-slate-900/50" />
        <div className="relative z-10 h-full p-5">
          <div className="flex items-start justify-between mb-4">
            <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Total Gained</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/[0.15] bg-white/[0.08] overflow-hidden">
              {(() => {
                const skill = SKILLS.find((s) => s.name.toLowerCase() === comp.metric.toLowerCase());
                return skill
                  ? <Image src={getSkillIcon(skill.icon)} alt={skill.name} width={32} height={32} unoptimized />
                  : <span className="text-xl">{METRIC_EMOJI[comp.metric.toLowerCase()] ?? '⚔️'}</span>;
              })()}
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-1 capitalize">{comp.metric}</p>
              <p className="text-lg font-bold text-white tabular-nums" style={{ animation: 'xpGlow 4s ease-in-out infinite' }}>
                {formatXp(totalXp)}
              </p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

// ─── Participants table ───────────────────────────────────────────────────────
type FilterView = 'all' | 'top10' | 'top25';

function ParticipantsTable({
  standings, status, progressPct, flashMap, recentChanges, changeCount, onResetCount,
}: {
  standings: Standing[]; status: string; progressPct: number;
  flashMap: Map<string, 'up' | 'down'>;
  recentChanges: RankChange[];
  changeCount: number;
  onResetCount: () => void;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterView>('all');
  const [mobileColView, setMobileColView] = useState(0);
  const touchStartX = useRef(0);
  const achievements = useMemo(() => getAchievements(standings), [standings]);
  const rankMap = useMemo(() => new Map(standings.map((s, i) => [s.username, i + 1])), [standings]);

  if (standings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center px-4">
        <span className="text-5xl">📊</span>
        <p className="text-sm font-semibold text-slate-300">No participants yet</p>
        <p className="text-xs text-slate-500">
          {status === 'upcoming' ? 'Standings will appear once the competition starts.' : 'Standings update as player snapshots are recorded.'}
        </p>
      </div>
    );
  }

  const maxXp = standings[0]?.xp_gained ?? 1;
  let filtered = standings;
  if (filter === 'top10') filtered = standings.slice(0, 10);
  else if (filter === 'top25') filtered = standings.slice(0, 25);
  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter((s) => s.display_name.toLowerCase().includes(q) || s.username.toLowerCase().includes(q));
  }

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) setMobileColView(diff > 0 ? 1 : 0);
  };

  return (
    <div>
      {/* Controls bar */}
      <div className="px-4 py-3 border-b border-white/[0.06] bg-white/[0.01] flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs pointer-events-none">🔍</span>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search player…"
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] pl-8 pr-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-sky-500/40 focus:bg-sky-500/5 transition-all" />
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          {(['all', 'top10', 'top25'] as FilterView[]).map((v) => (
            <button key={v} type="button" onClick={() => setFilter(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === v ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40' : 'text-slate-500 hover:text-slate-400 border border-transparent'}`}>
              {v === 'all' ? 'All' : v === 'top10' ? 'Top 10' : 'Top 25'}
            </button>
          ))}
        </div>
        {/* Live change ticker */}
        {changeCount > 0 && (
          <button type="button" onClick={onResetCount}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-all">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {changeCount} rank {changeCount === 1 ? 'change' : 'changes'}
          </button>
        )}
        {/* Mobile column hint */}
        <p className="text-[10px] text-slate-700 sm:hidden">← swipe for {mobileColView === 0 ? 'more columns' : 'main view'} →</p>
      </div>

      {/* Live activity feed */}
      <LiveActivityFeed changes={recentChanges} />

      <div className="overflow-x-auto" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-white/[0.08] bg-[hsl(220_23%_8%)]">
              <th className="px-4 py-4 text-left text-xs uppercase tracking-widest text-slate-500 font-semibold w-12">Rank</th>
              <th className="px-4 py-4 text-left text-xs uppercase tracking-widest text-slate-500 font-semibold">Player</th>
              <th className="px-4 py-4 text-right text-xs uppercase tracking-widest text-slate-500 font-semibold">XP Gained</th>
              <th className={`${mobileColView === 1 ? 'table-cell' : 'hidden'} sm:table-cell px-4 py-4 text-right text-xs uppercase tracking-widest text-slate-500 font-semibold`}>Predicted</th>
              <th className={`${mobileColView === 1 ? 'table-cell' : 'hidden'} sm:table-cell px-4 py-4 text-right text-xs uppercase tracking-widest text-slate-500 font-semibold`}>Start XP</th>
              <th className={`${mobileColView === 1 ? 'table-cell' : 'hidden'} sm:table-cell px-4 py-4 text-right text-xs uppercase tracking-widest text-slate-500 font-semibold`}>Current XP</th>
              <th className="hidden md:table-cell px-4 py-4 text-right text-xs uppercase tracking-widest text-slate-500 font-semibold">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {filtered.map((s) => {
              const rank = rankMap.get(s.username) ?? 0;
              const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
              const barPct = maxXp > 0 ? Math.round((s.xp_gained / maxXp) * 100) : 0;
              const milestone = getMilestone(s.xp_gained);
              const momentum = getMomentumIcon(rank, s.xp_gained, maxXp);
              const playerAchs = achievements.get(s.username) ?? [];
              const predicted = predictedFinalXp(s.xp_gained, progressPct);
              const flash = flashMap.get(s.username);
              const rowStyle = flash ? { animation: `${flash === 'up' ? 'rankUp' : 'rankDown'} 2.5s ease-out forwards` } : {};

              return (
                <tr key={s.username} style={rowStyle}
                  className={`transition-colors hover:bg-white/[0.05] group ${
                    rank === 1 ? 'border-l-2 border-l-yellow-500/30'
                    : rank === 2 ? 'border-l-2 border-l-slate-500/20'
                    : rank === 3 ? 'border-l-2 border-l-orange-500/20'
                    : ''
                  }`}>
                  {/* Rank */}
                  <td className="px-4 py-4 text-center font-bold w-12">
                    {medal ? (
                      <div className="relative inline-block">
                        <span className={`text-lg ${
                          rank === 1 ? 'drop-shadow-[0_0_10px_rgba(234,179,8,0.8)]'
                          : rank === 2 ? 'drop-shadow-[0_0_8px_rgba(148,163,184,0.6)]'
                          : 'drop-shadow-[0_0_8px_rgba(234,88,12,0.6)]'
                        }`}>{medal}</span>
                      </div>
                    ) : (
                      <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${rank <= 10 ? 'bg-slate-700/40 text-slate-300' : 'text-slate-600'}`}>
                        {rank}
                      </span>
                    )}
                    {/* Rank change arrow */}
                    {flash && (
                      <div className={`text-[10px] font-bold mt-0.5 ${flash === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {flash === 'up' ? '▲' : '▼'}
                      </div>
                    )}
                  </td>
                  {/* Player */}
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2.5">
                      <PlayerAvatar username={s.username} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Link href={`/player/${s.username}`} className={`font-semibold transition-colors hover:text-sky-400 ${rank <= 3 ? 'text-white' : 'text-slate-300'}`}>
                            {s.display_name}
                          </Link>
                          {momentum && <span className="text-sm" title="Momentum">{momentum}</span>}
                          {playerAchs.slice(0, 2).map((a) => (
                            <span key={a.label} title={`${a.label}: ${a.description}`} className="text-sm cursor-help">{a.icon}</span>
                          ))}
                        </div>
                        {milestone && (
                          <span className={`inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${milestone.color}`}>
                            {milestone.label} XP
                          </span>
                        )}
                        {s.xp_gained > 0 && (
                          <div className="mt-1.5 h-1 w-full max-w-[130px] overflow-hidden rounded-full bg-white/[0.06]">
                            <div className={`h-full rounded-full transition-all duration-300 ${
                              rank === 1 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400 shadow-lg shadow-yellow-500/30'
                              : rank === 2 ? 'bg-gradient-to-r from-slate-400 to-slate-300'
                              : rank === 3 ? 'bg-gradient-to-r from-orange-500 to-orange-400'
                              : 'bg-gradient-to-r from-sky-500 to-sky-400'
                            }`} style={{ width: `${barPct}%` }} />
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  {/* XP Gained */}
                  <td className="px-4 py-4 text-right tabular-nums font-bold">
                    <span className={s.xp_gained > 0 ? 'text-emerald-400' : 'text-slate-600'}>
                      {s.xp_gained > 0 ? `+${formatXp(s.xp_gained)}` : '—'}
                    </span>
                  </td>
                  {/* Predicted */}
                  <td className={`${mobileColView === 1 ? 'table-cell' : 'hidden'} sm:table-cell px-4 py-4 text-right tabular-nums text-xs`}>
                    {predicted && s.xp_gained > 0
                      ? <span className="text-amber-400/80 font-medium" title="Projected final XP at current pace">~{formatXp(predicted)}</span>
                      : <span className="text-slate-700">—</span>}
                  </td>
                  <td className={`${mobileColView === 1 ? 'table-cell' : 'hidden'} sm:table-cell px-4 py-4 text-right tabular-nums text-xs text-slate-500`}>{s.start_xp > 0 ? formatXp(s.start_xp) : '—'}</td>
                  <td className={`${mobileColView === 1 ? 'table-cell' : 'hidden'} sm:table-cell px-4 py-4 text-right tabular-nums text-xs text-slate-400 font-medium`}>{s.end_xp > 0 ? formatXp(s.end_xp) : '—'}</td>
                  <td className="hidden md:table-cell px-4 py-4 text-right text-xs text-slate-600">{timeAgo(s.last_updated_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-500">No players match your search.</div>
        )}
      </div>
    </div>
  );
}

// ─── Top 5 chart ─────────────────────────────────────────────────────────────
function Top5Chart({ chartData, metric }: { chartData: ChartSeries[]; metric: string }) {
  const hasData = chartData.some((s) => s.points.length > 0);
  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
        <span className="text-4xl">📈</span>
        <p className="text-sm font-semibold text-slate-300">No chart data yet</p>
        <p className="text-xs text-slate-500">Data points appear as snapshots are recorded during the competition.</p>
      </div>
    );
  }
  const datasets = chartData.map((series, i) => ({
    label: series.display_name,
    data: series.points.map((p) => ({ x: p.t, y: p.xp_gained })),
    borderColor: CHART_COLORS[i],
    backgroundColor: CHART_COLORS[i].replace('rgb', 'rgba').replace(')', ', 0.12)'),
    borderWidth: 2, pointRadius: 3, pointHoverRadius: 6, pointBackgroundColor: CHART_COLORS[i], tension: 0.3, fill: false,
  }));
  return (
    <div className="p-5">
      <p className="mb-4 text-sm font-semibold text-white">Top 5 participants — XP progression</p>
      <div className="rounded-xl border border-white/[0.07] bg-[hsl(220_23%_6%)] p-4">
        <Line data={{ datasets }} options={{
          responsive: true,
          interaction: { mode: 'index' as const, intersect: false },
          plugins: {
            legend: { position: 'bottom' as const, labels: { color: '#94a3b8', boxWidth: 10, boxHeight: 10, padding: 20, font: { size: 12 }, usePointStyle: true, pointStyle: 'circle' } },
            tooltip: {
              backgroundColor: 'rgba(10,15,28,0.97)', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1,
              titleColor: '#e2e8f0', bodyColor: '#94a3b8', padding: 12,
              callbacks: { label: (ctx) => `  ${ctx.dataset.label}: +${formatXp(ctx.parsed.y ?? 0)} xp` },
            },
          },
          scales: {
            x: { type: 'time' as const, time: { tooltipFormat: 'MMM d, h:mm a' }, grid: { color: 'rgba(255,255,255,0.04)' }, border: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#475569', maxTicksLimit: 8, font: { size: 11 } } },
            y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.04)' }, border: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#475569', font: { size: 11 }, callback: (v: string | number) => formatXp(Number(v)) } },
          },
        }} />
      </div>
      <p className="mt-3 text-center text-xs text-slate-600 capitalize">{metric} XP gained over time</p>
    </div>
  );
}

// ─── Achievement legend ───────────────────────────────────────────────────────
function AchievementLegend() {
  const items = [
    { icon: '👑', label: 'Leader', desc: 'Currently in 1st place' },
    { icon: '🚀', label: 'Million Club', desc: 'Gained 1M+ XP' },
    { icon: '⚡', label: 'XP Machine', desc: 'Gained 10M+ XP' },
    { icon: '📈', label: 'Overachiever', desc: '50%+ above average XP' },
    { icon: '🎯', label: 'Consistent', desc: 'Best relative gain' },
  ];
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3">Achievement Legend</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="text-base">{item.icon}</span>
            <div><p className="text-xs font-semibold text-slate-300">{item.label}</p><p className="text-[10px] text-slate-600">{item.desc}</p></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'overview',     label: 'Standings' },
  { key: 'chart',        label: 'Chart' },
  { key: 'achievements', label: 'Achievements' },
] as const;

export default function CompetitionDetailClient({ id }: { id: string }) {
  const [tab, setTab] = useState<'overview' | 'chart' | 'achievements'>('overview');
  const [now] = useState(() => Date.now());
  const [showAchievementLegend, setShowAchievementLegend] = useState(false);
  const confettiRef = useRef(false);
  const [confettiTrigger, setConfettiTrigger] = useState(false);

  const { data: comp, isLoading } = useSWR<CompetitionDetail>(
    `/api/competitions/${id}`,
    fetcher,
    { refreshInterval: (data: CompetitionDetail | undefined) => data?.status === 'active' ? 30000 : 0 }
  );

  // Rank change tracking
  const { recentChanges, changeCount, flashMap, resetCount } = useRankChanges(
    comp?.standings ?? [],
    comp?.status === 'active'
  );

  // Confetti: fire once when standings first load with top 3 players
  useEffect(() => {
    if (comp && comp.standings.length >= 3 && comp.standings[0].xp_gained > 0 && !confettiRef.current) {
      confettiRef.current = true;
      setConfettiTrigger(true);
    }
  }, [comp]);

  if (isLoading) return <LoadingSkeleton />;

  const isActive = comp?.status === 'active';
  const isEnding = isActive && comp && (new Date(comp.ends_at).getTime() - now) < 3 * 60 * 60 * 1000;

  if (!comp) {
    return (
      <div className="min-h-screen bg-[hsl(220_23%_7%)] flex items-center justify-center text-center px-4">
        <div>
          <p className="text-5xl mb-4">🏆</p>
          <p className="text-lg font-semibold text-slate-300">Competition not found</p>
          <p className="text-sm text-slate-500 mt-1">It may have been deleted or the link is incorrect.</p>
          <Link href="/competitions" className="mt-4 inline-block text-sm text-sky-400 hover:underline">← Back to Competitions</Link>
        </div>
      </div>
    );
  }

  const emoji = METRIC_EMOJI[comp.metric.toLowerCase()] ?? '⚔️';
  const activeParticipants = comp.standings.filter((s) => s.xp_gained > 0).length;
  const participationRate = comp.standings.length > 0 ? Math.round((activeParticipants / comp.standings.length) * 100) : 0;
  const statusConfig = {
    active:   { label: 'Live',     cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
    upcoming: { label: 'Upcoming', cls: 'bg-sky-500/15 text-sky-400 border-sky-500/25' },
    ended:    { label: 'Ended',    cls: 'bg-slate-500/15 text-slate-400 border-slate-500/25' },
  }[comp.status];

  return (
    <div className="min-h-screen bg-[hsl(220_23%_7%)] text-white">
      {/* Inject keyframe animations */}
      <style dangerouslySetInnerHTML={{ __html: ANIMATION_CSS }} />

      {/* Confetti celebration */}
      <ConfettiBurst trigger={confettiTrigger} />

      <div className="max-w-5xl mx-auto px-4 py-10 sm:px-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-8">
          <Link href="/groups" className="hover:text-sky-400 transition-colors">Groups</Link>
          <span>/</span>
          <Link href="/competitions" className="hover:text-sky-400 transition-colors">Competitions</Link>
          <span>/</span>
          <span className="text-slate-300 truncate">{comp.name}</span>
        </div>

        {/* Hero Header */}
        <div className="mb-8 rounded-3xl border border-white/[0.1] bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-transparent p-8 overflow-hidden relative">
          <div className={`absolute -right-40 -top-40 h-80 w-80 rounded-full blur-3xl opacity-20 ${
            comp.status === 'active' ? 'bg-emerald-500/30' : comp.status === 'upcoming' ? 'bg-sky-500/30' : 'bg-slate-500/20'
          }`} />
          <div className="relative z-10 flex items-start gap-6">
            <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border text-4xl font-bold shadow-xl ${
              comp.status === 'active'   ? 'border-emerald-500/40 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 shadow-emerald-500/20'
              : comp.status === 'upcoming' ? 'border-sky-500/40 bg-gradient-to-br from-sky-500/20 to-sky-500/5 shadow-sky-500/20'
              : 'border-slate-500/40 bg-gradient-to-br from-slate-500/20 to-slate-500/5 shadow-slate-500/20'
            }`}>
              {(() => {
                const skill = SKILLS.find((s) => s.name.toLowerCase() === comp.metric.toLowerCase());
                return skill ? <Image src={getSkillIcon(skill.icon)} alt={skill.name} width={48} height={48} unoptimized /> : <span>{emoji}</span>;
              })()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-white tracking-tight">{comp.name}</h1>
                <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border flex items-center gap-1.5 ${statusConfig.cls}`}>
                  <span className={`inline-block w-2 h-2 rounded-full ${comp.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                  {statusConfig.label}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 pt-4 border-t border-white/[0.1]">
                <div><p className="text-xs uppercase tracking-widest text-slate-500 mb-1">Metric</p><p className="text-sm font-semibold text-white capitalize">{comp.metric}</p></div>
                <div><p className="text-xs uppercase tracking-widest text-slate-500 mb-1">Participants</p><p className="text-sm font-semibold text-white">{comp.participant_count}</p></div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-500 mb-1">Hosted by</p>
                  <Link href={`/groups/${comp.group_slug}`} className="text-sm font-semibold text-sky-400 hover:text-sky-300 transition-colors">{comp.group_name}</Link>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-500 mb-1">Total XP Gained</p>
                  <p className="text-sm font-semibold text-emerald-400" style={{ animation: 'xpGlow 4s ease-in-out infinite' }}>
                    {formatXp(comp.total_gained ?? 0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-500 mb-1">Participation</p>
                  <div
                    title={`Participation: ${participationRate}% (${activeParticipants}/${comp.standings.length} members have gained XP)`}
                    className="inline-flex items-center gap-2 cursor-help"
                  >
                    <DonutChart pct={participationRate} color="#38bdf8" size={34} />
                    <span className="text-sm font-semibold text-sky-300">{participationRate}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Ending soon banner */}
        {isEnding && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-orange-500/5 px-5 py-4">
            <span className="mt-0.5 shrink-0 text-xl">⚠️</span>
            <div>
              <p className="text-sm font-semibold text-amber-200">Competition ending soon!</p>
              <p className="text-sm text-amber-300/80 mt-1">This competition ends in under 3 hours. Make sure player snapshots are recorded before it ends.</p>
            </div>
          </div>
        )}

        {/* Progress bar */}
        {isActive && (
          <div className="mb-8 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm font-semibold text-white">Competition Progress</p>
              <p className="text-sm font-bold text-emerald-400 tabular-nums">{comp.progress_pct}% complete</p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-500">
                <span>{formatDate(comp.starts_at)}</span>
                <span>{formatDate(comp.ends_at)}</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-white/[0.06] border border-white/[0.08] shadow-inner">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-500 shadow-lg shadow-emerald-500/40 transition-all duration-700"
                  style={{ width: `${comp.progress_pct}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* Stats grid */}
        <StatsGrid comp={comp} />

        {/* Tabs */}
        <div className="mb-0 border-b border-white/[0.08] flex items-center gap-0 overflow-x-auto">
          {TABS.map(({ key, label }) => (
            <button key={key} type="button" onClick={() => setTab(key)}
              className={`relative shrink-0 px-5 py-3 text-sm font-semibold transition-all ${tab === key ? 'text-white' : 'text-slate-500 hover:text-slate-400'}`}>
              {label}
              {tab === key && <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-500 to-emerald-500 rounded-t-full" />}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="rounded-b-2xl border border-t-0 border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.01] overflow-hidden">
          {tab === 'overview' && (
            <>
              <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between bg-white/[0.02]">
                <div>
                  <h2 className="text-sm font-bold text-white">Standings</h2>
                  <p className="text-xs text-slate-500 mt-1">{comp.standings.length} participants</p>
                </div>
                {isActive && (
                  <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Live Updates
                  </div>
                )}
              </div>
              <ParticipantsTable
                standings={comp.standings} status={comp.status} progressPct={comp.progress_pct}
                flashMap={flashMap} recentChanges={recentChanges}
                changeCount={changeCount} onResetCount={resetCount}
              />
            </>
          )}
          {tab === 'chart' && <Top5Chart chartData={comp.chart_data ?? []} metric={comp.metric} />}
          {tab === 'achievements' && (
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-white">Achievement Breakdown</p>
                <button type="button" onClick={() => setShowAchievementLegend((v) => !v)}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors border border-white/[0.08] rounded-lg px-3 py-1.5">
                  {showAchievementLegend ? 'Hide' : 'Show'} Legend
                </button>
              </div>
              {showAchievementLegend && <AchievementLegend />}
              <div className="mt-4 space-y-2">
                {(() => {
                  const achMap = getAchievements(comp.standings);
                  const achRankMap = new Map(comp.standings.map((s, i) => [s.username, i + 1]));
                  const earners = comp.standings.filter((s) => (achMap.get(s.username)?.length ?? 0) > 0);
                  if (earners.length === 0) {
                    return (
                      <div className="py-12 text-center">
                        <p className="text-5xl mb-3">🏅</p>
                        <p className="text-sm text-slate-400">Achievements unlock as players gain XP.</p>
                      </div>
                    );
                  }
                  return earners.map((s) => {
                    const rank = achRankMap.get(s.username) ?? 0;
                    const achs = achMap.get(s.username) ?? [];
                    return (
                      <div key={s.username} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 hover:bg-white/[0.04] transition-all">
                        <PlayerAvatar username={s.username} />
                        <span className="text-sm font-bold text-slate-500 w-5 shrink-0">{rank}</span>
                        <Link href={`/player/${s.username}`} className="font-semibold text-white hover:text-sky-400 transition-colors flex-1 truncate">{s.display_name}</Link>
                        <div className="flex items-center gap-1.5">
                          {achs.map((a) => (
                            <span key={a.label} title={`${a.label}: ${a.description}`} className={`text-lg cursor-help ${a.color}`}>{a.icon}</span>
                          ))}
                        </div>
                        <span className="text-xs text-emerald-400 tabular-nums font-semibold">+{formatXp(s.xp_gained)}</span>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6">
          <Link href={`/groups/${comp.group_slug}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-white transition-colors">
            ← {comp.group_name}
          </Link>
        </div>

      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[hsl(220_23%_7%)] text-white">
      <div className="max-w-5xl mx-auto px-4 py-10 sm:px-6 space-y-6">
        <div className="h-4 w-48 animate-pulse rounded-lg bg-white/[0.05]" />
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-8 space-y-4">
          <div className="flex gap-6">
            <div className="h-20 w-20 shrink-0 animate-pulse rounded-2xl bg-white/[0.05]" />
            <div className="flex-1 space-y-3">
              <div className="h-8 w-72 animate-pulse rounded-lg bg-white/[0.05]" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-white/[0.05]" />)}
              </div>
            </div>
          </div>
        </div>
        <div className="h-20 animate-pulse rounded-2xl bg-white/[0.05]" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-white/[0.05]" />)}
        </div>
        <div className="h-80 animate-pulse rounded-2xl bg-white/[0.05]" />
      </div>
    </div>
  );
}
