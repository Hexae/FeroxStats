/* eslint-disable @next/next/no-img-element */
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import useSWR from 'swr';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  BarController,
  Filler,
  Tooltip,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, BarController, Filler, Tooltip);

// Lazy-load only the React wrapper components to defer their bundle chunk
const LazyLine = lazy(() => import('react-chartjs-2').then(mod => ({ default: mod.Line })));
const LazyBar  = lazy(() => import('react-chartjs-2').then(mod => ({ default: mod.Bar })));
import {
  SKILLS,
  formatXp,
  formatNumber,
  getGameMode,
  getSkillIcon,
  virtualLevel,
  type FeroxHiscoreResponse,
  type SkillData,
} from '@/lib/osrs';

// ─── REPLACED BELOW — see full component ──────────────────────────────────────
// (This comment is intentionally left as a sentinel; the real implementation
//  follows after the type block. Do not remove anything between here and EOF.)

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlayerApiResponse extends FeroxHiscoreResponse {
  game_mode: string;
  is_claimed: boolean;
  last_fetched_at?: string | null;
  screenshots?: Array<{ id: string; public_url: string; created_at: string }>;
}

interface SkillGain {
  id: number;
  xpGained: number;
  levelsGained: number;
  rankChange: number;
}

interface PlayerGroupCompetition {
  id: string;
  name: string;
  metric: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  standing: { rank: number; xp_gained: number; total_participants: number } | null;
}

interface PlayerGroup {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_private: boolean;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  member_count: number;
  active_competitions: PlayerGroupCompetition[];
}

interface TopGainsResponse {
  period: string;
  gains: Array<{ username: string; display_name: string; xpGained: number; levelsGained: number }>;
}

interface GainsResponse {
  period: string;
  gains: true | null;
  totalXpGained?: number;
  xpStart?: number;
  xpEnd?: number;
  start?: string;
  end?: string;
  skillGains?: SkillGain[];
  dailyGains?: Array<{ date: string; xp: number }>;
  heatmap?: Array<{ date: string; xp: number }>;
  message?: string;
}

interface AchievementRecord {
  key: string;
  label: string;
  skillId?: number;
  completedAt: string;
  isLegacy: boolean;
}

interface NearestGoal {
  label: string;
  icon?: string;
  pct: number;
  xpLeft: number;
}

interface SkillRecord {
  xp: number;
  date: string;
}

type PeriodKey = 'fiveMin' | 'day' | 'week' | 'month' | 'year';

interface RecordsResponse {
  records: Record<string, Record<PeriodKey, SkillRecord | null>>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const XP_TABLE: number[] = (() => {
  const table: number[] = [0, 0];
  let pts = 0;
  for (let lvl = 1; lvl < 99; lvl++) {
    pts += Math.floor(lvl + 300 * Math.pow(2, lvl / 7));
    table.push(Math.floor(pts / 4));
  }
  return table;
})();

function xpForLevel(lvl: number): number {
  if (lvl <= 1) return 0;
  if (lvl >= 99) return 13_034_431;
  return XP_TABLE[lvl] ?? 0;
}

function progressToNext(xp: number, level: number): number {
  if (level >= 99) return 100;
  const current = xpForLevel(level);
  const next = xpForLevel(level + 1);
  if (next <= current) return 100;
  return Math.min(100, Math.floor(((xp - current) / (next - current)) * 100));
}

function calcCombatLevel(skills: SkillData[]): number {
  const get = (name: string) =>
    skills.find((s) => s.name === name)?.level ?? 1;
  const atk = get('Attack');
  const str = get('Strength');
  const def = get('Defence');
  const hp = get('Hitpoints');
  const prayer = get('Prayer');
  const ranged = get('Ranged');
  const magic = get('Magic');
  const base = 0.25 * (def + hp + Math.floor(prayer / 2));
  const melee = 0.325 * (atk + str);
  const range = 0.325 * (Math.floor(ranged / 2) + ranged);
  const mage = 0.325 * (Math.floor(magic / 2) + magic);
  return Math.floor(base + Math.max(melee, range, mage));
}

const GAIN_PERIODS = [
  { key: 'day', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'all', label: 'All Time' },
] as const;

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Shared milestone helpers ─────────────────────────────────────────────────

interface Milestone { label: string; value: number }

function milestoneProgress(current: number, milestones: Milestone[]): number {
  const n = milestones.length;
  if (n < 2) return 0;
  const segWidth = 100 / (n - 1);
  if (current >= milestones[n - 1].value) return 100;
  for (let i = 1; i < n; i++) {
    const lo = milestones[i - 1].value;
    const hi = milestones[i].value;
    if (current <= hi) {
      const t = hi === lo ? 1 : (current - lo) / (hi - lo);
      return (i - 1 + t) * segWidth;
    }
  }
  return 100;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AnimatedNumber({
  value,
  format = formatXp,
}: {
  value: number;
  format?: (n: number) => string;
}) {
  const [display, setDisplay] = useState(0);
  const frameRef = useRef<number>(0);
  const displayRef = useRef(0);

  useEffect(() => {
    const from = displayRef.current;
    const to = value;
    if (from === to) return;
    cancelAnimationFrame(frameRef.current);
    const duration = 900;
    let startTime = 0;
    const tick = (now: number) => {
      if (!startTime) startTime = now;
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const cur = Math.round(from + (to - from) * eased);
      displayRef.current = cur;
      setDisplay(cur);
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [value]);

  return <>{format(display)}</>;
}

function SkillCard({ skill }: { skill: SkillData }) {
  const xp = parseInt(skill.xp);
  const pct = progressToNext(xp, skill.level);
  const maxed = skill.level >= 99;
  const vLevel = maxed ? virtualLevel(xp) : skill.level;

  return (
    <div className="group relative flex flex-col gap-2 rounded-xl border border-white/5 bg-white/[0.03] p-3 transition hover:border-white/10 hover:bg-white/[0.06]">
      <div className="flex items-center gap-2">
        <div className="relative h-6 w-6 shrink-0">
          <Image
            src={getSkillIcon(SKILLS.find((s) => s.name === skill.name)?.icon ?? 'Stats_icon')}
            alt={skill.name}
            fill
            className="object-contain"
            unoptimized
          />
        </div>
        <span className="flex-1 truncate text-xs font-medium text-slate-400">{skill.name}</span>
        <span
          className={`text-sm font-bold tabular-nums ${maxed ? 'text-amber-400' : 'text-white'}`}
        >
          {vLevel}
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className={`h-full rounded-full transition-all ${maxed ? 'bg-amber-400' : 'bg-sky-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-500">{formatXp(xp)} xp</span>
        {skill.rank > 0 && (
          <span className="text-[10px] text-slate-500">#{formatNumber(skill.rank)}</span>
        )}
      </div>
    </div>
  );
}

// ─── XP Line Chart (cumulative) ────────────────────────────────────────────────────

function XpLineChart({ data }: { data: Array<{ date: string; xp: number }> }) {
  const chartData = useMemo(
    () => ({
      labels: data.map((d) =>
        new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })
      ),
      datasets: [
        {
          label: 'XP Gained',
          data: data.map((d) => d.xp),
          borderColor: 'rgba(74, 222, 128, 1)',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          backgroundColor: (ctx: any) => {
            const chart = ctx?.chart;
            const { chartArea } = chart ?? {};
            if (!chartArea) return 'rgba(74, 222, 128, 0.15)';
            const g = chart.ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            g.addColorStop(0, 'rgba(74, 222, 128, 0.35)');
            g.addColorStop(1, 'rgba(74, 222, 128, 0.02)');
            return g;
          },
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          pointRadius: data.length > 14 ? 2 : 4,
          pointBackgroundColor: 'rgba(74, 222, 128, 1)',
          pointBorderColor: 'transparent',
          pointHoverRadius: 6,
          spanGaps: true,
        },
      ],
    }),
    [data]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 700 },
      interaction: { mode: 'index' as const, intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(2, 6, 23, 0.92)',
          borderColor: 'rgba(148, 163, 184, 0.2)',
          borderWidth: 1,
          titleColor: 'rgba(226, 232, 240, 0.95)',
          bodyColor: 'rgba(74, 222, 128, 0.9)',
          padding: 10,
          cornerRadius: 10,
          displayColors: false,
          callbacks: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            label: (ctx: any) => `+${formatXp(ctx.parsed.y as number)} xp`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: 'rgba(148, 163, 184, 0.08)', drawTicks: false },
          ticks: {
            color: 'rgba(148, 163, 184, 0.6)',
            padding: 10,
            maxTicksLimit: 5,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            callback: (v: any) => {
              const n = Number(v);
              if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
              if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
              return String(n);
            },
          },
        },
        x: {
          border: { display: false },
          grid: { display: false },
          ticks: {
            color: 'rgba(148, 163, 184, 0.6)',
            padding: 8,
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 7,
          },
        },
      },
    }),
    []
  );

  if (data.length === 0) return null;

  return (
    <div className="h-48 w-full">
      <Suspense fallback={<div className="h-48 w-full animate-pulse bg-white/5 rounded-xl" />}>
        <LazyLine data={chartData} options={options} />
      </Suspense>
    </div>
  );
}

// ─── Daily XP Bar Chart ────────────────────────────────────────────────────────

function DailyXpBarChart({ data }: { data: Array<{ date: string; xp: number }> }) {
  const chartData = useMemo(
    () => ({
      labels: data.map((d) =>
        new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      ),
      datasets: [
        {
          label: 'XP Gained',
          data: data.map((d) => d.xp),
          backgroundColor: 'rgba(96, 165, 250, 0.7)',
          hoverBackgroundColor: 'rgba(96, 165, 250, 0.9)',
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    }),
    [data]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(2, 6, 23, 0.92)',
          borderColor: 'rgba(148, 163, 184, 0.2)',
          borderWidth: 1,
          titleColor: 'rgba(226, 232, 240, 0.9)',
          bodyColor: 'rgba(96, 165, 250, 0.9)',
          padding: 10,
          cornerRadius: 8,
          displayColors: false,
          callbacks: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            label: (ctx: any) => `+${formatXp(ctx.parsed.y as number)} xp`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: 'rgba(148, 163, 184, 0.07)', drawTicks: false },
          ticks: {
            color: 'rgba(148, 163, 184, 0.5)',
            padding: 8,
            maxTicksLimit: 4,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            callback: (v: any) => {
              const n = Number(v);
              if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
              if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
              return String(n);
            },
          },
        },
        x: {
          border: { display: false },
          grid: { display: false },
          ticks: {
            color: 'rgba(148, 163, 184, 0.5)',
            padding: 6,
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
          },
        },
      },
    }),
    []
  );

  const hasData = data.some((d) => d.xp > 0);

  if (!hasData) {
    return (
      <div className="flex h-32 items-center justify-center">
        <p className="text-sm text-slate-500">No gains</p>
      </div>
    );
  }

  return (
    <div className="h-36 w-full">
      <Suspense fallback={<div className="h-36 w-full animate-pulse bg-white/5 rounded-xl" />}>
        <LazyBar data={chartData} options={options} />
      </Suspense>
    </div>
  );
}

// ─── XP Heatmap ─────────────────────────────────────────────────────────────

const HEATMAP_COLORS = [
  'bg-white/[0.04]',  // 0 – no data
  'bg-emerald-950',   // 1 – very low
  'bg-emerald-800',   // 2 – low
  'bg-emerald-600',   // 3 – medium
  'bg-emerald-400',   // 4 – high
] as const;

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOW_LABELS   = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

function XpHeatmap({ data }: { data: Array<{ date: string; xp: number }> }) {
  const [tooltip, setTooltip] = useState<{
    date: string; xp: number; x: number; y: number;
  } | null>(null);

  // Build lookup
  const xpByDate = new Map<string, number>();
  for (const { date, xp } of data) {
    if (xp > 0) xpByDate.set(date, xp);
  }

  // Build 53-week grid aligned to Sunday, ending today
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const start = new Date(today);
  start.setDate(start.getDate() - 364);
  start.setDate(start.getDate() - start.getDay()); // rewind to Sunday

  type Cell = { date: string; xp: number; future: boolean };
  const weeks: Cell[][] = [];
  const cur = new Date(start);
  while (weeks.length < 53) {
    const week: Cell[] = [];
    for (let d = 0; d < 7; d++) {
      const str = cur.toISOString().slice(0, 10);
      week.push({ date: str, xp: xpByDate.get(str) ?? 0, future: cur > today });
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }

  const maxXp = Math.max(...xpByDate.values(), 1);
  const getLevel = (xp: number): 0 | 1 | 2 | 3 | 4 => {
    if (xp === 0) return 0;
    const pct = xp / maxXp;
    if (pct < 0.10) return 1;
    if (pct < 0.30) return 2;
    if (pct < 0.65) return 3;
    return 4;
  };

  // Month labels: emit when a new month starts inside the grid
  const monthLabels: { label: string; col: number }[] = [];
  for (let wi = 0; wi < weeks.length; wi++) {
    const d = new Date(weeks[wi][0].date + 'T12:00:00');
    const m = d.getMonth();
    if (d.getDate() <= 7) {
      const last = monthLabels[monthLabels.length - 1];
      if (!last || last.label !== MONTH_LABELS[m]) {
        monthLabels.push({ label: MONTH_LABELS[m], col: wi });
      }
    }
  }

  return (
    <div className="relative select-none overflow-x-auto pb-1">
      {/* Month labels */}
      <div className="mb-1 flex">
        <div className="w-7 shrink-0" />
        <div className="relative h-4" style={{ width: 53 * 14 }}>
          {monthLabels.map(({ label, col }) => (
            <span
              key={`${label}-${col}`}
              className="absolute text-[10px] leading-none text-slate-500"
              style={{ left: col * 14 }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex">
        {/* Day-of-week labels */}
        <div className="mr-1 flex w-6 flex-col gap-[3px]">
          {DOW_LABELS.map((d, i) => (
            <div
              key={i}
              className="flex h-[11px] items-center justify-end text-[9px] leading-none text-slate-600"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Weeks */}
        <div className="flex gap-[3px]">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((cell, di) => (
                <div
                  key={di}
                  className={[
                    'h-[11px] w-[11px] cursor-default rounded-[2px]',
                    cell.future ? 'opacity-0' : HEATMAP_COLORS[getLevel(cell.xp)],
                    cell.date === todayStr ? 'ring-1 ring-white/30' : '',
                  ].join(' ')}
                  onMouseEnter={(e) => {
                    if (cell.future) return;
                    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setTooltip({ date: cell.date, xp: cell.xp, x: r.left + r.width / 2, y: r.top });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-2 flex items-center justify-end gap-1.5">
        <span className="text-[10px] text-slate-600">Less</span>
        {HEATMAP_COLORS.map((c, i) => (
          <div key={i} className={`h-[10px] w-[10px] rounded-[2px] ${c}`} />
        ))}
        <span className="text-[10px] text-slate-600">More</span>
      </div>

      {/* Floating tooltip (portal-like via fixed) */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 rounded-lg border border-white/10 bg-slate-900 px-2.5 py-1.5 text-xs shadow-xl"
          style={{ left: tooltip.x, top: tooltip.y - 8, transform: 'translate(-50%, -100%)' }}
        >
          <p className="font-semibold text-white">
            {tooltip.xp > 0 ? `+${formatXp(tooltip.xp)} xp` : 'No activity'}
          </p>
          <p className="text-slate-400">
            {new Date(tooltip.date + 'T12:00:00').toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
            })}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Skill Table Row ───────────────────────────────────────────────────────────

function SkillTableRow({
  row,
  highlight,
}: {
  row: { id: number; name: string; icon: string; xpGained: number; levelsGained: number; rankChange: number; currentRank: number };
  highlight?: boolean;
}) {
  return (
    <div
      className={[
        'grid grid-cols-[minmax(0,1fr)_100px_48px_64px_72px] items-center gap-0 px-3 py-1.5 transition hover:bg-white/[0.03]',
        highlight ? 'bg-white/[0.025] py-2' : '',
        row.xpGained > 0 && !highlight ? 'bg-white/[0.015]' : '',
      ].join(' ')}
    >
      {/* Skill name + icon */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="relative h-4 w-4 shrink-0">
          <Image src={getSkillIcon(row.icon)} alt={row.name} fill className="object-contain" unoptimized />
        </div>
        <span className={[
          'truncate text-xs',
          highlight ? 'font-bold text-slate-100' : row.xpGained > 0 ? 'font-semibold text-slate-200' : 'text-slate-500',
        ].join(' ')}>
          {row.name}
        </span>
      </div>
      {/* Exp */}
      <span className={`text-right text-xs tabular-nums font-medium ${
        row.xpGained > 0 ? 'text-emerald-400' : 'text-slate-600'
      }`}>
        {row.xpGained > 0 ? `+${formatXp(row.xpGained)}` : '0'}
      </span>
      {/* Levels */}
      <span className={`text-right text-xs tabular-nums ${
        row.levelsGained > 0 ? 'text-amber-400 font-semibold' : 'text-slate-600'
      }`}>
        {row.levelsGained > 0 ? `+${row.levelsGained}` : '0'}
      </span>
      {/* Rank Gained */}
      <span className={`text-right text-xs tabular-nums ${
        row.rankChange > 0 ? 'text-emerald-500 font-semibold' : row.rankChange < 0 ? 'text-red-400 font-semibold' : 'text-slate-600'
      }`}>
        {row.rankChange !== 0 ? (row.rankChange > 0 ? `+${formatNumber(row.rankChange)}` : formatNumber(row.rankChange)) : '—'}
      </span>
      {/* Current Rank */}
      <span className={`text-right text-xs tabular-nums ${
        row.currentRank > 0 ? 'text-slate-300' : 'text-slate-600'
      }`}>
        {row.currentRank > 0 ? `#${formatNumber(row.currentRank)}` : '—'}
      </span>
    </div>
  );
}

// ─── Achievement Progress ───────────────────────────────────────────────────

const SKILL_XP_MILESTONES: Milestone[] = [
  { label: '0',    value: 0 },
  { label: '99',   value: 13_034_431 },
  { label: '50m',  value: 50_000_000 },
  { label: '100m', value: 100_000_000 },
  { label: '200m', value: 200_000_000 },
];

const BASE_STATS_MILESTONES: Milestone[] = [
  { label: '0',  value: 0 },
  { label: '60', value: 60 },
  { label: '70', value: 70 },
  { label: '80', value: 80 },
  { label: '90', value: 90 },
  { label: '99', value: 99 },
];

// ─── Circular progress indicator ─────────────────────────────────────────────

function CircularProgress({ pct, size = 44 }: { pct: number; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, pct) / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 absolute inset-0">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.06)" strokeWidth="3" fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke="#22c55e" strokeWidth="3" fill="none"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-bold text-emerald-400">{Math.floor(pct)}%</span>
      </div>
    </div>
  );
}

// ─── XP left formatter (lowercase k / m) ─────────────────────────────────────

function fmtXpLeft(xp: number): string {
  if (xp >= 1_000_000) return `${(xp / 1_000_000).toFixed(2)}m`;
  if (xp >= 1_000) return `${Math.round(xp / 1_000)}k`;
  return xp.toLocaleString();
}

// ─── Nearest goals computation ────────────────────────────────────────────────

function computeNearestGoals(skills: SkillData[]): NearestGoal[] {
  const nonOverall = skills.filter((s) => s.id !== 0);
  const overall = skills.find((s) => s.id === 0);
  const totalXp = parseInt(overall?.xp ?? '0');
  const goals: NearestGoal[] = [];
  const XP_99 = 13_034_431;

  // Base N Stats
  for (const target of [60, 70, 80, 90] as const) {
    const targetXp = xpForLevel(target);
    const xpTowards = nonOverall.reduce((sum, s) => sum + Math.min(parseInt(s.xp), targetXp), 0);
    const xpTotal = nonOverall.length * targetXp;
    if (xpTotal === 0) continue;
    const xpLeft = xpTotal - xpTowards;
    if (xpLeft <= 0) continue;
    goals.push({ label: `Base ${target} Stats`, pct: (xpTowards / xpTotal) * 100, xpLeft });
  }

  // Individual skill 99s
  for (const skill of nonOverall) {
    if (skill.level >= 99) continue;
    const skillXp = parseInt(skill.xp);
    const xpLeft = XP_99 - skillXp;
    const icon = SKILLS.find((s) => s.name === skill.name)?.icon;
    goals.push({ label: `99 ${skill.name}`, icon, pct: (skillXp / XP_99) * 100, xpLeft });
  }

  // Overall XP milestones – show only the nearest uncompleted one
  for (const milestone of [200_000_000, 500_000_000, 1_000_000_000, 2_000_000_000] as const) {
    if (totalXp < milestone) {
      const label =
        milestone >= 1_000_000_000
          ? `${milestone / 1_000_000_000}B Overall Exp.`
          : `${milestone / 1_000_000}m Overall Exp.`;
      goals.push({ label, icon: 'Stats_icon', pct: (totalXp / milestone) * 100, xpLeft: milestone - totalXp });
      break;
    }
  }

  return goals.sort((a, b) => b.pct - a.pct).slice(0, 5);
}

// ─── Achievement Row (milestone bars) ─────────────────────────────────────────

function AchievementRow({
  icon,
  name,
  current,
  milestones,
}: {
  icon?: string;
  name: string;
  current: number;
  milestones: Milestone[];
}) {
  const pct = milestoneProgress(current, milestones);
  const n = milestones.length;

  return (
    <div className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.03]">
      {/* Icon */}
      {icon ? (
        <div className="relative h-6 w-6 shrink-0">
          <Image src={getSkillIcon(icon)} alt={name} fill className="object-contain" unoptimized />
        </div>
      ) : (
        <div className="h-6 w-6 shrink-0" />
      )}

      {/* Name */}
      <span className="w-28 shrink-0 text-sm font-medium text-slate-300">{name}</span>

      {/* Track */}
      <div className="relative flex-1">
        {/* Base track */}
        <div className="h-[3px] w-full rounded-full bg-white/[0.06]" />
        {/* Fill */}
        <div
          className="absolute top-0 left-0 h-[3px] rounded-full bg-emerald-500 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
        {/* Milestone dots */}
        {milestones.map((m, i) => {
          const pos = (i / (n - 1)) * 100;
          const reached = current >= m.value;
          return (
            <div
              key={m.label}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${pos}%` }}
            >
              <div
                className={[
                  'flex h-[22px] min-w-[28px] items-center justify-center rounded-full border px-1.5',
                  'text-[10px] font-bold tabular-nums transition-colors',
                  reached
                    ? 'border-emerald-500 bg-emerald-500/20 text-white'
                    : 'border-white/10 bg-[hsl(220_23%_9%)] text-slate-500',
                ].join(' ')}
              >
                {m.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AchievementProgress({ skills, username }: { skills: SkillData[]; username: string }) {
  const overall = skills.find((s) => s.id === 0);
  const nonOverall = skills.filter((s) => s.id !== 0);

  const totalXp = parseInt(overall?.xp ?? '0');
  const minLevel = nonOverall.length > 0 ? Math.min(...nonOverall.map((s) => s.level)) : 0;

  // Fetch snapshot-based achievement dates
  const { data: achData, isLoading: achLoading } = useSWR<{ achievements: AchievementRecord[] }>(
    `/api/player/${encodeURIComponent(username)}/achievements`,
    fetcher
  );

  const nearestGoals = useMemo(() => computeNearestGoals(skills), [skills]);

  const recentAchievements = useMemo(() => {
    if (!achData?.achievements) return [];
    return achData.achievements
      .filter((a) => !a.isLegacy && a.skillId !== undefined)
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
      .slice(0, 5);
  }, [achData]);

  // Skills at 99 that aren't in snapshot records (app wasn't tracking yet)
  const untrackedNinetyNines = useMemo(() => {
    const trackedIds = new Set(recentAchievements.map((a) => a.skillId));
    return nonOverall
      .filter((s) => s.level >= 99 && !trackedIds.has(s.id))
      .map((s) => ({
        key: `untracked_${s.id}`,
        label: `99 ${s.name}`,
        skillId: s.id,
        completedAt: '',
        isLegacy: false,
      }));
  }, [nonOverall, recentAchievements]);

  const legacyAchievements = useMemo(() => {
    if (!achData?.achievements) return [];
    return achData.achievements
      .filter((a) => a.isLegacy)
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  }, [achData]);

  // Dynamic last milestone for Overall: round up to nearest 100m above current
  const overallMilestones: Milestone[] = [
    { label: '0',    value: 0 },
    { label: '100m', value: 100_000_000 },
    { label: '200m', value: 200_000_000 },
    { label: '500m', value: 500_000_000 },
    { label: '1b',   value: 1_000_000_000 },
    { label: '2b',   value: 2_000_000_000 },
    {
      label: formatXp(Math.max(totalXp, 2_000_000_001)),
      value: Math.max(totalXp, 2_000_000_001),
    },
  ];

  const displayRecent = [...recentAchievements, ...untrackedNinetyNines].slice(0, 5);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">

      {/* ── Left: Achievement Progress bars ──────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03]">
        <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
          <span className="text-base">🏆</span>
          <h2 className="text-sm font-semibold text-slate-200">Achievement Progress</h2>
        </div>
        <div className="divide-y divide-white/[0.04] py-2">
          {/* Overall XP track */}
          <AchievementRow
            icon="Stats_icon"
            name="Overall"
            current={totalXp}
            milestones={overallMilestones}
          />
          {/* Base Stats (lowest level of all skills) */}
          <AchievementRow
            name="Base Stats"
            current={minLevel}
            milestones={BASE_STATS_MILESTONES}
          />
          {/* Individual skills */}
          {nonOverall.map((skill) => {
            const icon = SKILLS.find((s) => s.name === skill.name)?.icon;
            return (
              <AchievementRow
                key={skill.id}
                icon={icon}
                name={skill.name}
                current={parseInt(skill.xp)}
                milestones={SKILL_XP_MILESTONES}
              />
            );
          })}
        </div>
      </div>

      {/* ── Right: Recent / Nearest / Legacy panels ───────────────────────── */}
      <div className="space-y-4">

        {/* Recent skill achievements */}
        <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03]">
          <div className="border-b border-white/5 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-200">Recent skill achievements</h3>
          </div>
          {achLoading ? (
            <div className="divide-y divide-white/[0.04] py-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="mx-4 my-2 h-10 animate-pulse rounded-lg bg-white/5" style={{ animationDelay: `${i * 60}ms` }} />
              ))}
            </div>
          ) : displayRecent.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-slate-500">No level 99s yet.</p>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {displayRecent.map((ach) => {
                const skillMeta = SKILLS.find((s) => s.id === ach.skillId);
                return (
                  <div key={ach.key} className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.03]">
                    {skillMeta ? (
                      <div className="relative h-6 w-6 shrink-0">
                        <Image src={getSkillIcon(skillMeta.icon)} alt={skillMeta.name} fill className="object-contain" unoptimized />
                      </div>
                    ) : (
                      <div className="h-6 w-6 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-200">{ach.label}</p>
                      {ach.completedAt ? (
                        <p className="text-[11px] text-slate-500">
                          {new Date(ach.completedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-600">Date not tracked</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Nearest skill achievements */}
        <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03]">
          <div className="border-b border-white/5 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-200">Nearest skill achievements</h3>
          </div>
          {nearestGoals.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-slate-500">All goals completed!</p>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {nearestGoals.map((goal) => (
                <div key={goal.label} className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.03]">
                  {goal.icon ? (
                    <div className="relative h-6 w-6 shrink-0">
                      <Image src={getSkillIcon(goal.icon)} alt={goal.label} fill className="object-contain" unoptimized />
                    </div>
                  ) : (
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                      <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 6h18M3 14h12M3 18h8" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-200">{goal.label}</p>
                    <p className="text-[11px] text-slate-500">{fmtXpLeft(goal.xpLeft)} left</p>
                  </div>
                  <CircularProgress pct={goal.pct} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Legacy skill achievements */}
        {legacyAchievements.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03]">
            <div className="border-b border-white/5 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-200">Legacy skill achievements</h3>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {legacyAchievements.map((ach) => {
                const skillMeta = ach.skillId !== undefined ? SKILLS.find((s) => s.id === ach.skillId) : undefined;
                return (
                  <div key={ach.key} className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.03]">
                    {skillMeta ? (
                      <div className="relative h-6 w-6 shrink-0">
                        <Image src={getSkillIcon(skillMeta.icon)} alt={skillMeta.name} fill className="object-contain" unoptimized />
                      </div>
                    ) : (
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                        <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 6h18M3 14h12M3 18h8" />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-200">{ach.label}</p>
                      <p className="text-[11px] text-slate-500">
                        {new Date(ach.completedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Records Panel ────────────────────────────────────────────────────────────

const RECORD_PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'fiveMin', label: '5 Min' },
  { key: 'day',     label: 'Day' },
  { key: 'week',    label: 'Week' },
  { key: 'month',   label: 'Month' },
  { key: 'year',    label: 'Year' },
];

function RecordsPanel({
  username,
  skills,
}: {
  username: string;
  skills: SkillData[];
}) {
  const { data, isLoading } = useSWR<RecordsResponse>(
    `/api/player/${encodeURIComponent(username)}/records`,
    fetcher
  );

  const nonOverall = skills.filter((s) => s.id !== 0);
  // Put Overall first, then non-overall skills in their natural order
  const allSkills = [...skills.filter((s) => s.id === 0), ...nonOverall];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="h-52 animate-pulse rounded-2xl bg-white/5"
            style={{ animationDelay: `${i * 50}ms` }}
          />
        ))}
      </div>
    );
  }

  const records = data?.records ?? {};

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {allSkills.map((skill) => {
        const skillMeta = SKILLS.find((s) => s.id === skill.id);
        const skillRecords = records[skill.id];

        return (
          <div
            key={skill.id}
            className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03]"
          >
            {/* Skill header */}
            <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2.5">
              {skillMeta && (
                <div className="relative h-5 w-5 shrink-0">
                  <Image
                    src={getSkillIcon(skillMeta.icon)}
                    alt={skill.name}
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
              )}
              <span className="text-sm font-bold text-slate-200">{skill.name}</span>
            </div>

            {/* Period rows */}
            <div className="divide-y divide-white/[0.04]">
              {RECORD_PERIODS.map(({ key, label }) => {
                const rec = skillRecords?.[key] ?? null;
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between px-3 py-2 text-xs transition hover:bg-white/[0.02]"
                  >
                    <span className="w-14 shrink-0 text-slate-500">{label}</span>
                    {rec ? (
                      <div className="text-right">
                        <p className="font-semibold tabular-nums text-emerald-400">+{formatXp(rec.xp)}</p>
                        <p className="text-[10px] text-slate-600">
                          {new Date(rec.date).toLocaleDateString('en-US', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    ) : (
                      <div className="text-right">
                        <p className="font-medium text-slate-600">N/A</p>
                        <p className="text-[10px] text-slate-700">Not set</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Player Groups Panel ──────────────────────────────────────────────────────

const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
  owner: { label: 'Owner', cls: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' },
  admin: { label: 'Admin', cls: 'bg-blue-500/20 text-blue-300 border border-blue-500/30' },
  member: { label: 'Member', cls: 'bg-white/5 text-slate-400 border border-white/10' },
};

function timeRemaining(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return 'Ended';
  const hrs = Math.floor(ms / 3600000);
  if (hrs < 24) return `${hrs}h left`;
  return `${Math.floor(hrs / 24)}d left`;
}

function PlayerGroupsPanel({
  groups,
  isLoading,
  username,
}: {
  groups: PlayerGroup[];
  isLoading: boolean;
  username: string;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/5" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-white/5 bg-white/[0.03]">
        <div className="text-center">
          <p className="text-2xl mb-2">👥</p>
          <p className="text-sm font-medium text-slate-300">{username} isn&apos;t in any groups</p>
          <p className="mt-1 text-xs text-slate-500">Groups appear here once they join one.</p>
          <Link
            href="/groups"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-sky-500"
          >
            Browse Groups
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const badge = ROLE_BADGE[group.role] ?? ROLE_BADGE.member;
        const activeComps = group.active_competitions.filter((c) => c.is_active);
        const upcomingComps = group.active_competitions.filter((c) => !c.is_active);

        return (
          <div key={group.id} className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03]">
            {/* Group header */}
            <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-white/5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/groups/${group.slug}`}
                    className="text-base font-bold text-white hover:text-sky-400 transition truncate"
                  >
                    {group.name}
                  </Link>
                  {group.is_private && (
                    <span className="text-[10px] rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-slate-500">
                      🔒 Private
                    </span>
                  )}
                  <span className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>
                {group.description && (
                  <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{group.description}</p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                <span className="text-xs text-slate-400 tabular-nums">{group.member_count} members</span>
                <span className="text-[10px] text-slate-600">
                  Joined {new Date(group.joined_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>

            {/* Active competitions */}
            {activeComps.length > 0 && (
              <div className="px-4 py-3 space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Active Competitions</p>
                {activeComps.map((comp) => {
                  const standing = comp.standing;
                  return (
                    <div
                      key={comp.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.025] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">{comp.name}</p>
                        <p className="text-[11px] text-slate-500 capitalize">{comp.metric} · {timeRemaining(comp.ends_at)}</p>
                      </div>
                      {standing ? (
                        <div className="shrink-0 text-right">
                          <p className={`text-sm font-bold tabular-nums ${standing.rank <= 3 ? 'text-amber-400' : 'text-slate-300'}`}>
                            #{standing.rank}
                            <span className="text-slate-600 text-xs font-normal"> / {standing.total_participants}</span>
                          </p>
                          {standing.xp_gained > 0 && (
                            <p className="text-[11px] text-emerald-400 tabular-nums">+{formatXp(standing.xp_gained)} xp</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-600">No data yet</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Upcoming competitions (no standing yet) */}
            {upcomingComps.length > 0 && (
              <div className={`px-4 py-3 ${activeComps.length > 0 ? 'border-t border-white/[0.04]' : ''}`}>
                <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Upcoming</p>
                <div className="flex flex-wrap gap-2">
                  {upcomingComps.map((comp) => (
                    <span
                      key={comp.id}
                      className="rounded-lg border border-white/5 bg-white/[0.025] px-3 py-1.5 text-xs text-slate-400"
                    >
                      {comp.name}
                      <span className="ml-1.5 text-slate-600">
                        starts {new Date(comp.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* No competitions */}
            {group.active_competitions.length === 0 && (
              <div className="px-4 py-3">
                <p className="text-xs text-slate-600">No active or upcoming competitions</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PlayerPageClient({ username, isOwner }: { username: string; isOwner: boolean }) {
  const [tab, setTab] = useState<'skills' | 'achievements' | 'gains' | 'records' | 'groups' | 'screenshot'>('skills');
  const [gainPeriod, setGainPeriod] = useState<'day' | 'week' | 'month' | 'all'>('week');
  const [screenshots, setScreenshots] = useState<Array<{ id: string; public_url: string; created_at: string }> | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  function openLightbox(idx: number) { setLightboxIndex(idx); }
  function closeLightbox() { setLightboxIndex(null); }

  const { data, error, isLoading, mutate } = useSWR<PlayerApiResponse>(
    `/api/player/${encodeURIComponent(username)}`,
    fetcher
  );

  const { data: groupsData, isLoading: groupsLoading } = useSWR<PlayerGroup[]>(
    tab === 'groups'
      ? `/api/player/${encodeURIComponent(username)}/groups`
      : null,
    fetcher
  );

  const { data: topGainsData } = useSWR<TopGainsResponse>(
    tab === 'gains' && gainPeriod !== 'all'
      ? `/api/top-gains?period=${gainPeriod}&limit=50`
      : null,
    fetcher
  );

  const { data: gainsData, isLoading: gainsLoading } = useSWR<GainsResponse>(
    tab === 'gains'
      ? `/api/player/${encodeURIComponent(username)}/gains?period=${gainPeriod}`
      : null,
    fetcher
  );

  // Hooks must be before any conditional returns
  const allSkillRows = useMemo(
    () =>
      SKILLS.map((s) => {
        const gain = gainsData?.skillGains?.find((g) => g.id === s.id);
        const currentRank = data?.skills?.find((sk) => sk.id === s.id)?.rank ?? 0;
        return {
          id: s.id,
          name: s.name,
          icon: s.icon,
          xpGained: gain?.xpGained ?? 0,
          levelsGained: gain?.levelsGained ?? 0,
          rankChange: gain?.rankChange ?? 0,
          currentRank,
        };
      }),
    [gainsData, data]
  );

  const cumulativeData = useMemo(() => {
    const daily = gainsData?.dailyGains ?? [];
    if (!daily.length || !gainsData?.xpStart) return [];
    let running = gainsData.xpStart;
    return daily.map((d) => {
      running += d.xp;
      return { date: d.date, xp: running };
    });
  }, [gainsData]);

  const xpPerDay = useMemo(() => {
    if (!gainsData?.start || !gainsData?.end || !gainsData?.totalXpGained) return null;
    const ms = new Date(gainsData.end).getTime() - new Date(gainsData.start).getTime();
    const days = Math.max(0.0417, ms / 86400000); // floor at ~1 hr to avoid division issues
    return Math.round(gainsData.totalXpGained / days);
  }, [gainsData]);

  const topGainsRank = useMemo(() => {
    if (!topGainsData?.gains) return null;
    const idx = topGainsData.gains.findIndex(
      (g) => g.username.toLowerCase() === username.toLowerCase()
    );
    return idx >= 0 ? idx + 1 : null;
  }, [topGainsData, username]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-sky-500" />
          <p className="text-sm text-slate-500">Loading {username.replace(/\b\w/g, c => c.toUpperCase())}…</p>
        </div>
      </div>
    );
  }

  if (error || !data || 'error' in data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <p className="text-4xl mb-4">⚠️</p>
          <h2 className="mb-2 text-lg font-semibold text-slate-200">Player not found</h2>
          <p className="mb-6 text-sm text-slate-500">
            <strong className="text-slate-300">{username.replace(/\b\w/g, c => c.toUpperCase())}</strong> doesn&apos;t appear on the
            Ferox.ps hiscores.
          </p>
          <Link
            href="/hiscores"
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500"
          >
            Browse Hiscores
          </Link>
        </div>
      </div>
    );
  }

  const skills = data.skills ?? [];
  const overall = skills.find((s) => s.id === 0);
  const nonOverall = skills.filter((s) => s.id !== 0);
  const combatLevel = calcCombatLevel(nonOverall);
  const gameMode = getGameMode(data.game_mode ?? 'regular');
  const maxedCount = nonOverall.filter((s) => s.level >= 99).length;
  const virtualTotal = nonOverall.reduce((sum, s) => sum + virtualLevel(parseInt(s.xp)), 0);

  const rawName = data.name ?? username;
  const displayName = rawName.replace(/\b\w/g, (c) => c.toUpperCase());

  const overallRow = allSkillRows.find((r) => r.id === 0);
  const skillRows = allSkillRows.filter((r) => r.id !== 0);

  const groupCount = groupsData?.length;

  const TABS = [
    { key: 'skills', label: `Skills (${nonOverall.length})` },
    { key: 'achievements', label: 'Achievements' },
    { key: 'gains', label: 'XP Gains' },
    { key: 'records', label: 'Records' },
    { key: 'groups', label: groupCount != null ? `Groups (${groupCount})` : 'Groups' },
    { key: 'screenshot', label: 'Screenshot' },
  ] as const;

  async function handleScreenshotUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    await uploadFiles(files);
    e.target.value = '';
  }

  async function uploadFiles(files: File[]) {
    const items = screenshots ?? data?.screenshots ?? [];
    const available = 10 - items.length;
    const toUpload = files.slice(0, available);
    if (!toUpload.length) {
      setUploadMsg({ type: 'err', text: 'Maximum of 10 screenshots reached' });
      return;
    }
    setUploadMsg(null);
    setUploadLoading(true);
    let added = 0;
    let lastErr = '';
    for (const file of toUpload) {
      const form = new FormData();
      form.append('screenshot', file);
      try {
        const res = await fetch(`/api/player/${encodeURIComponent(username)}/screenshot`, {
          method: 'POST',
          body: form,
        });
        const json = await res.json();
        if (!res.ok) {
          lastErr = json.error ?? 'Upload failed';
        } else {
          setScreenshots(prev => [...(prev ?? []), json]);
          added++;
        }
      } catch {
        lastErr = 'Upload failed. Please try again.';
      }
    }
    setUploadLoading(false);
    if (added > 0) {
      mutate();
      setUploadMsg({ type: 'ok', text: `${added} screenshot${added > 1 ? 's' : ''} added!` });
    } else {
      setUploadMsg({ type: 'err', text: lastErr });
    }
  }

  async function handleScreenshotRemove(id: string) {
    if (!confirm('Remove this screenshot?')) return;
    setUploadMsg(null);
    setUploadLoading(true);
    try {
      const res = await fetch(
        `/api/player/${encodeURIComponent(username)}/screenshot?id=${encodeURIComponent(id)}`,
        { method: 'DELETE' },
      );
      const json = await res.json();
      if (!res.ok) {
        setUploadMsg({ type: 'err', text: json.error ?? 'Failed to remove' });
      } else {
        setScreenshots(prev => (prev ?? []).filter(s => s.id !== id));
        mutate();
      }
    } catch {
      setUploadMsg({ type: 'err', text: 'Remove failed. Please try again.' });
    } finally {
      setUploadLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-blue-900/20 via-transparent to-purple-900/20" />
        <div className="relative z-10 flex items-center gap-4">
          {/* Avatar */}
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/60 shadow-lg">
            <span className="bg-gradient-to-br from-amber-400 via-sky-400 to-purple-500 bg-clip-text text-xl font-black text-transparent">
              {displayName.slice(0, 2).toUpperCase()}
            </span>
          </div>
          {/* Name + badges */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl truncate">
                {displayName}
              </h1>
              <span className={`rounded-full border border-white/10 px-2 py-0.5 text-[11px] font-medium ${gameMode.color} bg-white/5`}>
                {gameMode.emoji && <img src={gameMode.emoji} className="inline-block w-4 h-4 mr-1" alt="" />}{gameMode.label}
              </span>
              {data.is_claimed && (
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                  ✓ Verified
                </span>
              )}
            </div>
            {data.last_fetched_at && (
              <p className="mt-0.5 text-[10px] text-slate-500">
                Updated {formatRelativeTime(data.last_fetched_at)}
              </p>
            )}
          </div>
          {/* Stats row */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            {overall && (
              <>
                <HeroStat label="Total XP" value={parseInt(overall.xp)} format={formatXp} color="text-amber-400" />
                {overall.rank > 0 && (
                  <HeroStat label="Rank" value={overall.rank} format={(n) => `#${formatNumber(n)}`} color="text-purple-400" />
                )}
                <HeroStat label="Total Level" value={overall.level} format={formatNumber} color="text-white" />
                {virtualTotal > overall.level && (
                  <HeroStat label="Virtual" value={virtualTotal} format={formatNumber} color="text-slate-400" />
                )}
              </>
            )}
            <HeroStat label="Combat" value={combatLevel} format={String} color="text-sky-400" />
            {maxedCount > 0 && (
              <HeroStat label="99s" value={maxedCount} format={String} color="text-amber-400" />
            )}
          </div>
        </div>
        {/* Stats row (mobile) */}
        <div className="sm:hidden mt-3 flex flex-wrap gap-2">
          {overall && (
            <>
              <HeroStat label="Total XP" value={parseInt(overall.xp)} format={formatXp} color="text-amber-400" />
              {overall.rank > 0 && (
                <HeroStat label="Rank" value={overall.rank} format={(n) => `#${formatNumber(n)}`} color="text-purple-400" />
              )}
              <HeroStat label="Total Level" value={overall.level} format={formatNumber} color="text-white" />
              {virtualTotal > overall.level && (
                <HeroStat label="Virtual" value={virtualTotal} format={formatNumber} color="text-slate-400" />
              )}
            </>
          )}
          <HeroStat label="Combat" value={combatLevel} format={String} color="text-sky-400" />
          {maxedCount > 0 && (
            <HeroStat label="99s" value={maxedCount} format={String} color="text-amber-400" />
          )}
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 rounded-xl border border-white/5 bg-white/[0.03] p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === t.key
                ? 'bg-sky-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Skills Tab ────────────────────────────────────────────────────── */}
      {tab === 'skills' && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {nonOverall.map((skill) => (
            <SkillCard key={skill.id} skill={skill} />
          ))}
        </div>
      )}

      {/* ── Achievements Tab ──────────────────────────────────────────────── */}
      {tab === 'achievements' && (
        <AchievementProgress skills={skills} username={username} />
      )}

      {/* Gains Tab */}
      {tab === 'gains' && (
        <div className="space-y-4">
          {/* Period picker */}
          <div className="flex gap-1 rounded-xl border border-white/5 bg-white/[0.03] p-1 w-fit">
            {GAIN_PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setGainPeriod(p.key)}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                  gainPeriod === p.key
                    ? 'bg-sky-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Gains summary strip */}
          {!gainsLoading && gainsData?.gains && (
            <div className="flex flex-wrap gap-2">
              <div className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-2.5">
                <p className="text-[10px] uppercase tracking-widest text-slate-500">Total XP Gained</p>
                <p className="text-sm font-bold tabular-nums text-emerald-400">+{formatXp(gainsData.totalXpGained ?? 0)}</p>
              </div>
              {topGainsRank !== null && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5">
                  <p className="text-[10px] uppercase tracking-widest text-amber-500/70">
                    {gainPeriod === 'day' ? 'Today' : gainPeriod === 'week' ? 'This Week' : 'This Month'} Rank
                  </p>
                  <p className="text-sm font-bold tabular-nums text-amber-400">#{topGainsRank}</p>
                </div>
              )}
              {xpPerDay !== null && (
                <div className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-2.5">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500">Avg XP / Day</p>
                  <p className="text-sm font-bold tabular-nums text-sky-400">{formatXp(xpPerDay)}</p>
                </div>
              )}
              {gainsData.start && gainsData.end && (
                <div className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-2.5">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500">Period</p>
                  <p className="text-sm font-bold text-slate-300">
                    {new Date(gainsData.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {' – '}
                    {new Date(gainsData.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Two-panel layout */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_500px]">

            {/* Left: skill table */}
            <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03]">
              <div className="grid grid-cols-[minmax(0,1fr)_100px_48px_64px_72px] gap-0 border-b border-white/5 px-3 py-2 text-[10px] uppercase tracking-widest text-slate-500">
                <span>Skill</span>
                <span className="text-right">Exp.</span>
                <span className="text-right">Lvl</span>
                <span className="text-right">+/- Rank</span>
                <span className="text-right">Rank</span>
              </div>
              {gainsLoading ? (
                <div className="space-y-px p-2">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="h-9 animate-pulse rounded bg-white/5" style={{ animationDelay: `${i * 40}ms` }} />
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-white/[0.025]">
                  {overallRow && <SkillTableRow row={overallRow} highlight />}
                  {skillRows.map((row) => (
                    <SkillTableRow key={row.id} row={row} />
                  ))}
                </div>
              )}
            </div>

            {/* Right: summary + charts */}
            <div className="space-y-3">

              {/* Cumulative XP line chart */}
              <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                <p className="mb-0.5 text-sm font-semibold text-slate-200">Cumulative experience gained</p>
                <p className="mb-3 text-xs text-slate-500">
                  A timeline of Overall experience over the past{' '}
                  <span className="font-medium text-slate-300">
                    {gainPeriod === 'day' ? 'day' : gainPeriod === 'week' ? 'week' : gainPeriod === 'month' ? 'month' : 'all time'}
                  </span>
                </p>
                {gainsLoading ? (
                  <div className="h-36 animate-pulse rounded-lg bg-white/5" />
                ) : (
                  <XpLineChart data={cumulativeData} />
                )}
              </div>

              {/* Daily bar chart */}
              <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                <p className="mb-0.5 text-sm font-semibold text-slate-200">Daily experience gained</p>
                <p className="mb-3 text-xs text-slate-500">Overall experience gains, bucketed by day</p>
                {gainsLoading ? (
                  <div className="h-36 animate-pulse rounded-lg bg-white/5" />
                ) : (
                  <DailyXpBarChart data={gainsData?.dailyGains ?? []} />
                )}
              </div>

              {/* Heatmap */}
              <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                <p className="mb-0.5 text-sm font-semibold text-slate-200">Gains heatmap</p>
                <p className="mb-3 text-xs text-slate-500">A heatmap of the past year&apos;s Overall experience gains</p>
                {gainsLoading ? (
                  <div className="h-[88px] animate-pulse rounded-lg bg-white/5" />
                ) : (
                  <XpHeatmap data={gainsData?.heatmap ?? []} />
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── Records Tab ───────────────────────────────────────────────────── */}
      {tab === 'records' && (
        <RecordsPanel username={username} skills={skills} />
      )}

      {/* ── Groups Tab ────────────────────────────────────────────────────── */}
      {tab === 'groups' && (
        <PlayerGroupsPanel
          groups={groupsData ?? []}
          isLoading={groupsLoading}
          username={username}
        />
      )}

      {/* ── Screenshot Tab ────────────────────────────────────────────────── */}
      {tab === 'screenshot' && (() => {
        const items = screenshots ?? data.screenshots ?? [];
        const canAdd = isOwner && items.length < 10;

        function handleDragOver(e: React.DragEvent) {
          e.preventDefault();
          setIsDraggingOver(true);
        }
        function handleDragLeave() { setIsDraggingOver(false); }
        function handleDrop(e: React.DragEvent) {
          e.preventDefault();
          setIsDraggingOver(false);
          if (!canAdd || uploadLoading) return;
          const files = Array.from(e.dataTransfer.files).filter(f =>
            ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(f.type)
          );
          if (files.length) uploadFiles(files);
        }

        return (
          <>
            {/* Lightbox */}
            {lightboxIndex !== null && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 cursor-pointer"
                onClick={closeLightbox}
              >
                {/* Prev */}
                {items.length > 1 && (
                  <button
                    className="absolute left-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
                    onClick={e => { e.stopPropagation(); openLightbox((lightboxIndex - 1 + items.length) % items.length); }}
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                  </button>
                )}

                <div className="relative" onClick={e => e.stopPropagation()}>
                  <Image
                    src={items[lightboxIndex].public_url}
                    alt={`${displayName} screenshot ${lightboxIndex + 1}`}
                    width={1280}
                    height={720}
                    className="rounded-xl object-contain shadow-2xl"
                    style={{ height: '90vh', width: '90vw', objectFit: 'contain' }}
                    unoptimized
                  />
                  <button
                    onClick={closeLightbox}
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg bg-black/70 text-slate-400 hover:text-white transition-colors"
                    title="Close"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  {items.length > 1 && (
                    <p className="mt-2 text-center text-xs text-slate-500">{lightboxIndex + 1} / {items.length}</p>
                  )}
                </div>

                {/* Next */}
                {items.length > 1 && (
                  <button
                    className="absolute right-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
                    onClick={e => { e.stopPropagation(); openLightbox((lightboxIndex + 1) % items.length); }}
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                )}
              </div>
            )}

            <div
              className={`rounded-2xl border bg-white/[0.03] p-5 space-y-4 transition-colors ${
                isOwner && isDraggingOver
                  ? 'border-sky-500/50 bg-sky-500/5'
                  : 'border-white/[0.07]'
              }`}
              onDragOver={isOwner ? handleDragOver : undefined}
              onDragLeave={isOwner ? handleDragLeave : undefined}
              onDrop={isOwner ? handleDrop : undefined}
            >
              {/* Header row (owner only) */}
              {isOwner && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">{items.length} / 10 screenshots</p>
                  <div className="flex items-center gap-3">
                    {uploadMsg && (
                      <span className={`text-xs font-medium ${uploadMsg.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {uploadMsg.text}
                      </span>
                    )}
                    {canAdd && (
                      <label className={`cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white px-3 py-1.5 text-xs font-semibold transition-colors ${uploadLoading ? 'pointer-events-none opacity-50' : ''}`}>
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        {uploadLoading ? 'Uploading…' : 'Add Screenshots'}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          multiple
                          className="sr-only"
                          onChange={handleScreenshotUpload}
                          disabled={uploadLoading}
                        />
                      </label>
                    )}
                  </div>
                </div>
              )}

              {/* Gallery grid */}
              {items.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {items.map((s, idx) => (
                    <div
                      key={s.id}
                      className="group relative overflow-hidden rounded-xl border border-white/10 cursor-pointer"
                      onClick={() => openLightbox(idx)}
                    >
                      <Image
                        src={s.public_url}
                        alt={`${displayName} screenshot ${idx + 1}`}
                        width={400}
                        height={225}
                        className="w-full object-cover aspect-video"
                        unoptimized
                      />
                      {/* View hint */}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                        <svg className="h-8 w-8 text-white drop-shadow" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803M15.803 15.803L21 21M10.5 7.5v6m3-3h-6" />
                        </svg>
                      </div>
                      {isOwner && (
                        <button
                          onClick={e => { e.stopPropagation(); handleScreenshotRemove(s.id); }}
                          disabled={uploadLoading}
                          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/70 text-slate-400 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100 disabled:opacity-40"
                          title="Remove"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                  {/* Drop zone tile (when owner has items but under limit) */}
                  {canAdd && (
                    <label className={`flex aspect-video cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
                      isDraggingOver ? 'border-sky-400 bg-sky-500/10' : 'border-white/10 hover:border-white/20 hover:bg-white/[0.02]'
                    } ${uploadLoading ? 'pointer-events-none opacity-40' : ''}`}>
                      <svg className="mb-1.5 h-6 w-6 text-slate-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      <span className="text-xs text-slate-500">Add more</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        multiple
                        className="sr-only"
                        onChange={handleScreenshotUpload}
                        disabled={uploadLoading}
                      />
                    </label>
                  )}
                </div>
              ) : isOwner ? (
                /* Empty-state drop zone */
                <label
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed py-16 text-center transition-colors ${
                    isDraggingOver ? 'border-sky-400 bg-sky-500/10' : 'border-white/10 hover:border-white/20'
                  } ${uploadLoading ? 'pointer-events-none opacity-50' : ''}`}
                >
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-black/40">
                    <svg className="h-7 w-7 text-slate-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5V19a1.5 1.5 0 001.5 1.5h15A1.5 1.5 0 0021 19v-2.5M12 3v12m0-12l-3.5 3.5M12 3l3.5 3.5" />
                    </svg>
                  </div>
                  <p className="mb-1 text-sm font-semibold text-slate-300">Drop screenshots here</p>
                  <p className="mb-4 text-xs text-slate-500">or click to browse &mdash; up to 10 images, 5 MB each</p>
                  <span className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5V19a1.5 1.5 0 001.5 1.5h15A1.5 1.5 0 0021 19v-2.5M12 3v12m0-12l-3.5 3.5M12 3l3.5 3.5" />
                    </svg>
                    {uploadLoading ? 'Uploading…' : 'Upload Screenshots'}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    className="sr-only"
                    onChange={handleScreenshotUpload}
                    disabled={uploadLoading}
                  />
                  {uploadMsg && (
                    <p className={`mt-4 text-xs font-medium ${uploadMsg.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {uploadMsg.text}
                    </p>
                  )}
                </label>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm text-slate-500">No screenshots uploaded yet.</p>
                </div>
              )}
            </div>
          </>
        );
      })()}
    </div>
  );
}

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

function HeroStat({
  label,
  value,
  format,
  color,
}: {
  label: string;
  value: number;
  format: (n: number) => string;
  color: string;
}) {
  return (
    <div className="flex flex-col gap-0 rounded-xl border border-white/5 bg-black/20 px-3 py-2">
      <p className="text-[9px] uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`text-sm font-bold tabular-nums ${color}`}>
        <AnimatedNumber value={value} format={format} />
      </p>
    </div>
  );
}
