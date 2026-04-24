'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { formatXp, getSkillIcon, SKILLS } from '@/lib/osrs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, TimeScale);

interface Standing {
  username: string;
  display_name: string;
  xp_gained: number;
  start_xp: number;
  end_xp: number;
  last_updated_at: string | null;
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

const METRIC_EMOJI: Record<string, string> = {
  overall: '⚔️', attack: '🗡️', defence: '🛡️', strength: '💪', hitpoints: '❤️',
  ranged: '🏹', prayer: '🙏', magic: '🔮', cooking: '🍳', woodcutting: '🪓',
  fletching: '🪃', fishing: '🎣', firemaking: '🔥', crafting: '⚒️', smithing: '🔨',
  mining: '⛏️', herblore: '🌿', agility: '🏃', thieving: '🗝️', slayer: '💀',
  farming: '🌾', runecraft: '✨', hunter: '🦅', construction: '🏠',
};

// OSRS Wiki skill background images (hosted on wiki CDN)
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

const CHART_COLORS = [
  'rgb(74,144,226)',    // blue
  'rgb(231,76,60)',     // red
  'rgb(241,196,15)',    // yellow
  'rgb(46,204,113)',    // green
  'rgb(155,89,182)',    // purple
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
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

function durationLabel(starts: string, ends: string): string {
  const days = Math.round((new Date(ends).getTime() - new Date(starts).getTime()) / 86400000);
  if (days === 1) return '1 day';
  if (days < 7) return `${days} days`;
  const weeks = Math.round(days / 7);
  return weeks === 1 ? '1 week' : `${weeks} weeks`;
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

// ─── Stats grid ───────────────────────────────────────────────────────────────

function StatsGrid({ comp }: { comp: CompetitionDetail }) {
  const top = comp.standings[0];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
      {/* Duration */}
      <div className="col-span-2 sm:col-span-1 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-4">
        <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-3">Duration</p>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between gap-2">
            <span className="text-slate-500">Start</span>
            <span className="text-slate-200 font-medium text-right">{formatDate(comp.starts_at)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-500">End</span>
            <span className="text-slate-200 font-medium text-right">{formatDate(comp.ends_at)}</span>
          </div>
          <div className="pt-1 text-center text-[11px] font-semibold text-slate-400 border-t border-white/[0.05]">
            {durationLabel(comp.starts_at, comp.ends_at)}
          </div>
        </div>
      </div>

      {/* Countdown */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-4">
        <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-3">
          {comp.status === 'active' ? 'Time Remaining' : comp.status === 'upcoming' ? 'Starts In' : 'Ended'}
        </p>
        {comp.status === 'ended'
          ? <p className="text-xs text-slate-400">{formatDate(comp.ends_at)}</p>
          : <CountdownTimer targetAt={comp.status === 'active' ? comp.ends_at : comp.starts_at} />
        }
      </div>

      {/* Top participant */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-4">
        <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-3">Top Participant</p>
        {top ? (
          <div>
            <Link href={`/player/${top.username}`} className="block text-sm font-bold text-white hover:text-sky-400 truncate transition-colors">
              {top.display_name}
            </Link>
            <p className="text-xs text-emerald-400 font-semibold mt-1 tabular-nums">+{formatXp(top.xp_gained)} xp</p>
          </div>
        ) : <p className="text-sm text-slate-500">—</p>}
      </div>

      {/* Total gained — WOM-style skill scene card */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] min-h-[100px]">
        {/* Background scene */}
        {SKILL_BG_IMAGE[comp.metric.toLowerCase()] && (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${SKILL_BG_IMAGE[comp.metric.toLowerCase()]})` }}
          />
        )}
        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/30" />
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center h-full px-5 py-5">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-3">Total Gained</p>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.15] bg-black/30 backdrop-blur-sm overflow-hidden">
              {(() => {
                const skill = SKILLS.find((s) => s.name.toLowerCase() === comp.metric.toLowerCase());
                return skill
                  ? <Image src={getSkillIcon(skill.icon)} alt={skill.name} width={32} height={32} unoptimized />
                  : <span className="text-2xl">{METRIC_EMOJI[comp.metric.toLowerCase()] ?? '⚔️'}</span>;
              })()}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-300 capitalize">{comp.metric}</p>
              <p className="text-xl font-bold text-white tabular-nums leading-tight">{formatXp(comp.total_gained ?? 0)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Participants table ───────────────────────────────────────────────────────

function ParticipantsTable({ standings, status }: { standings: Standing[]; status: string }) {
  if (standings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center px-4">
        <span className="text-4xl">📊</span>
        <p className="text-sm font-semibold text-slate-300">No data yet</p>
        <p className="text-xs text-slate-500">
          {status === 'upcoming' ? 'Standings appear once the competition starts.' : 'Standings update as player snapshots are recorded.'}
        </p>
      </div>
    );
  }

  const maxXp = standings[0]?.xp_gained ?? 1;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.07]">
            <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-widest text-slate-500 w-14">Rank</th>
            <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest text-slate-500">Player</th>
            <th className="px-4 py-2.5 text-right text-[10px] uppercase tracking-widest text-slate-500">Gained</th>
            <th className="hidden sm:table-cell px-4 py-2.5 text-right text-[10px] uppercase tracking-widest text-slate-500">Start XP</th>
            <th className="hidden sm:table-cell px-4 py-2.5 text-right text-[10px] uppercase tracking-widest text-slate-500">End XP</th>
            <th className="hidden md:table-cell px-4 py-2.5 text-right text-[10px] uppercase tracking-widest text-slate-500">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {standings.map((s, i) => {
            const rank = i + 1;
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
            const barPct = maxXp > 0 ? Math.round((s.xp_gained / maxXp) * 100) : 0;
            return (
              <tr key={s.username} className={`group transition-colors hover:bg-white/[0.025] ${rank === 1 ? 'bg-yellow-500/[0.03]' : ''}`}>
                <td className="px-4 py-3 text-center w-14">
                  {medal
                    ? <span className="text-lg">{medal}</span>
                    : <span className="text-sm font-semibold text-slate-500 tabular-nums">{rank}</span>}
                </td>
                <td className="px-3 py-3">
                  <Link href={`/player/${s.username}`} className={`font-medium transition-colors hover:text-sky-400 ${rank <= 3 ? 'text-slate-100' : 'text-slate-300'}`}>
                    {s.display_name}
                  </Link>
                  {s.xp_gained > 0 && (
                    <div className="mt-1 h-0.5 w-full max-w-[120px] overflow-hidden rounded-full bg-white/[0.05]">
                      <div
                        className={`h-full rounded-full ${rank === 1 ? 'bg-yellow-400' : rank === 2 ? 'bg-slate-300' : rank === 3 ? 'bg-amber-500' : 'bg-sky-600'}`}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold">
                  <span className={s.xp_gained > 0 ? 'text-emerald-400' : 'text-slate-600'}>
                    {s.xp_gained > 0 ? `+${formatXp(s.xp_gained)}` : '—'}
                  </span>
                </td>
                <td className="hidden sm:table-cell px-4 py-3 text-right tabular-nums text-xs text-slate-500">{s.start_xp > 0 ? formatXp(s.start_xp) : '—'}</td>
                <td className="hidden sm:table-cell px-4 py-3 text-right tabular-nums text-xs text-slate-400">{s.end_xp > 0 ? formatXp(s.end_xp) : '—'}</td>
                <td className="hidden md:table-cell px-4 py-3 text-right text-xs text-slate-600">{timeAgo(s.last_updated_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
    borderWidth: 2,
    pointRadius: 3,
    pointHoverRadius: 6,
    pointBackgroundColor: CHART_COLORS[i],
    tension: 0.3,
    fill: false,
  }));

  return (
    <div className="p-5">
      <p className="mb-4 text-sm font-semibold text-white">Top 5 participants</p>
      <div className="rounded-xl border border-white/[0.07] bg-[hsl(220_23%_6%)] p-4">
        <Line
          data={{ datasets }}
          options={{
            responsive: true,
            interaction: { mode: 'index' as const, intersect: false },
            plugins: {
              legend: {
                position: 'bottom' as const,
                labels: {
                  color: '#94a3b8',
                  boxWidth: 10,
                  boxHeight: 10,
                  padding: 20,
                  font: { size: 12 },
                  usePointStyle: true,
                  pointStyle: 'circle',
                },
              },
              tooltip: {
                backgroundColor: 'rgba(10,15,28,0.97)',
                borderColor: 'rgba(255,255,255,0.08)',
                borderWidth: 1,
                titleColor: '#e2e8f0',
                bodyColor: '#94a3b8',
                padding: 12,
                callbacks: {
                  label: (ctx) => `  ${ctx.dataset.label}: +${formatXp(ctx.parsed.y ?? 0)} xp`,
                },
              },
            },
            scales: {
              x: {
                type: 'time' as const,
                time: { tooltipFormat: 'MMM d, h:mm a' },
                grid: { color: 'rgba(255,255,255,0.04)' },
                border: { color: 'rgba(255,255,255,0.06)' },
                ticks: { color: '#475569', maxTicksLimit: 8, font: { size: 11 } },
              },
              y: {
                beginAtZero: true,
                grid: { color: 'rgba(255,255,255,0.04)' },
                border: { color: 'rgba(255,255,255,0.06)' },
                ticks: {
                  color: '#475569',
                  font: { size: 11 },
                  callback: (v: string | number) => formatXp(Number(v)),
                },
              },
            },
          }}
        />
      </div>
      <p className="mt-3 text-center text-xs text-slate-600 capitalize">{metric} XP gained over time</p>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CompetitionDetailClient({ id }: { id: string }) {
  const [tab, setTab] = useState<'overview' | 'chart'>('overview');
  const [now] = useState(() => Date.now());

  const { data: comp, isLoading, error } = useSWR<CompetitionDetail>(
    `/api/competitions/${id}`,
    fetcher,
    { refreshInterval: (data: CompetitionDetail | undefined) => data?.status === 'active' ? 30000 : 0 }
  );

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

  const statusConfig = {
    active:   { label: '● Ongoing',  cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
    upcoming: { label: '◎ Upcoming', cls: 'bg-sky-500/15 text-sky-400 border-sky-500/25' },
    ended:    { label: '✓ Ended',    cls: 'bg-slate-500/15 text-slate-400 border-slate-500/25' },
  }[comp.status];

  return (
    <div className="min-h-screen bg-[hsl(220_23%_7%)] text-white">
      <div className="max-w-4xl mx-auto px-4 py-10 sm:px-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
          <Link href="/groups" className="hover:text-sky-400 transition-colors">Groups</Link>
          <span>/</span>
          <Link href="/competitions" className="hover:text-sky-400 transition-colors">Competitions</Link>
          <span>/</span>
          <span className="text-slate-300 truncate">{comp.name}</span>
        </div>

        {/* Header */}
        <div className="flex items-start gap-5 mb-6">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.05] shadow-inner overflow-hidden">
            {(() => {
              const skill = SKILLS.find((s) => s.name.toLowerCase() === comp.metric.toLowerCase());
              return skill ? (
                <Image src={getSkillIcon(skill.icon)} alt={skill.name} width={40} height={40} unoptimized />
              ) : <span className="text-4xl">{emoji}</span>;
            })()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-white tracking-tight leading-tight">{comp.name}</h1>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusConfig.cls}`}>
                {statusConfig.label}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-slate-400">
              <span className="capitalize">{comp.metric}</span>
              <span className="text-slate-600">·</span>
              <span>{comp.participant_count} participants</span>
              <span className="text-slate-600">·</span>
              <span>Hosted by <Link href={`/groups/${comp.group_slug}`} className="text-slate-300 hover:text-sky-400 transition-colors">{comp.group_name}</Link></span>
            </div>
          </div>
        </div>

        {/* Ending soon banner */}
        {isEnding && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.07] px-4 py-3">
            <span className="mt-0.5 shrink-0">⚠️</span>
            <p className="text-sm text-amber-300">This competition ends in under 3 hours. Make sure player snapshots are recorded before it ends.</p>
          </div>
        )}

        {/* Progress bar */}
        {isActive && (
          <div className="mb-6 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-5 py-4">
            <div className="flex justify-between text-xs text-slate-500 mb-2">
              <span>{formatDate(comp.starts_at)}</span>
              <span className="font-semibold text-slate-400 tabular-nums">{comp.progress_pct}% complete</span>
              <span>{formatDate(comp.ends_at)}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-500 transition-all duration-700"
                style={{ width: `${comp.progress_pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Stats grid */}
        <StatsGrid comp={comp} />

        {/* Tabs */}
        <div className="flex items-center gap-0 border-b border-white/[0.07] mb-0">
          {(['overview', 'chart'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2.5 text-sm font-medium capitalize transition-all border-b-2 -mb-px ${
                tab === t ? 'text-white border-sky-500' : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}
            >
              {t === 'chart' ? 'Top 5 Chart' : 'Participants'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="rounded-b-2xl rounded-tr-2xl border border-t-0 border-white/[0.08] bg-[hsl(220_23%_8%)] overflow-hidden">
          {tab === 'overview' && (
            <>
              <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Standings</h2>
                <div className="flex items-center gap-3">
                  {isActive && (
                    <span className="flex items-center gap-1.5 text-xs text-slate-500">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Live
                    </span>
                  )}
                  <span className="text-xs text-slate-600">{comp.standings.length} players</span>
                </div>
              </div>
              <ParticipantsTable standings={comp.standings} status={comp.status} />
            </>
          )}
          {tab === 'chart' && <Top5Chart chartData={comp.chart_data ?? []} metric={comp.metric} />}
        </div>

        {/* Footer link */}
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
      <div className="max-w-4xl mx-auto px-4 py-10 sm:px-6 space-y-5">
        <div className="h-4 w-48 animate-pulse rounded-lg bg-white/[0.04]" />
        <div className="flex gap-4">
          <div className="h-16 w-16 shrink-0 animate-pulse rounded-2xl bg-white/[0.04]" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-7 w-72 animate-pulse rounded-lg bg-white/[0.04]" />
            <div className="h-4 w-56 animate-pulse rounded-lg bg-white/[0.04]" />
          </div>
        </div>
        <div className="h-14 animate-pulse rounded-2xl bg-white/[0.04]" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/[0.04]" />)}
        </div>
        <div className="h-80 animate-pulse rounded-2xl bg-white/[0.04]" />
      </div>
    </div>
  );
}
