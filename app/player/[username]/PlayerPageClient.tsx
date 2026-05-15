'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect, useRef, useMemo, useDeferredValue, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlayerApiResponse extends FeroxHiscoreResponse {
  game_mode: string;
  is_claimed: boolean;
  last_fetched_at?: string | null;
  country?: string | null;
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
  rank: number | null;
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

interface MilestoneRow {
  id: string;
  skill_id: number;
  skill_name: string;
  old_level: number;
  new_level: number;
  xp: number;
  achieved_at: string;
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

interface CollectionLogItem {
  key: string;
  name: string;
  eventType: 'RARE_DROP' | 'PET_OBTAINED';
  rarityTier: 'mythic' | 'legendary' | 'epic' | 'rare' | 'uncommon' | 'common' | 'unknown';
  dropRateOdds: string | null;
  dropRateDenominator: number | null;
  obtainedCount: number;
  firstObtainedAt: string | null;
  lastObtainedAt: string | null;
  firstKc: number | null;
  lastKc: number | null;
  imageUrl: string | null;
}

interface CollectionLogCategory {
  key: string;
  label: string;
  itemCount: number;
  eventCount: number;
  maxKills: number | null;
  firstObtainedAt: string | null;
  lastObtainedAt: string | null;
  items: CollectionLogItem[];
  knownDrops: string[];
  knownPets: string[];
}

interface CollectionLogResponse {
  configured: boolean;
  message?: string;
  error?: string;
  summary: {
    totalItems: number;
    totalCategories: number;
    totalEvents: number;
    firstObtainedAt: string | null;
    lastObtainedAt: string | null;
  };
  categories: CollectionLogCategory[];
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

function formatCalendarDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Unknown';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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
  const trueMaxed = xp >= 200_000_000;
  const vLevel = maxed ? virtualLevel(xp) : skill.level;
  const levelColor = trueMaxed ? 'text-[#6f4bd8]' : maxed ? 'text-amber-400' : 'text-white';
  const barColor = trueMaxed ? 'bg-[#6f4bd8]' : maxed ? 'bg-amber-400' : 'bg-sky-500';

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
          className={`text-sm font-bold tabular-nums ${levelColor}`}
        >
          {vLevel}
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
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

// ─── XP left formatter  ─────────────────────────────────────

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
    <div className="flex flex-col gap-2 px-3 sm:px-4 py-2 sm:py-3 transition hover:bg-white/[0.03]">
      {/* Icon + Name */}
      <div className="flex items-center gap-2 min-w-0">
        {icon ? (
          <div className="relative h-5 w-5 sm:h-6 sm:w-6 shrink-0">
            <Image src={getSkillIcon(icon)} alt={name} fill className="object-contain" unoptimized />
          </div>
        ) : (
          <div className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" />
        )}
        <span className="min-w-0 flex-1 truncate text-xs sm:text-sm font-medium text-slate-300">{name}</span>
      </div>

      {/* Track */}
      <div className="relative flex-1 w-full">
        {/* Base track */}
        <div className="h-[3px] w-full rounded-full bg-white/[0.06]" />
        {/* Fill */}
        <div
          className="absolute top-0 left-0 h-[3px] rounded-full bg-emerald-500 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
        {/* Milestone dots */}
        <div className="relative h-8 mt-1 overflow-visible">
          {milestones.map((m, i) => {
            const pos = (i / (n - 1)) * 100;
            const reached = current >= m.value;
            return (
              <div
                key={m.label}
                className="absolute top-0 -translate-x-1/2"
                style={{ left: `${pos}%` }}
              >
                <div
                  className={[
                    'flex h-5 sm:h-[22px] min-w-[24px] sm:min-w-[28px] items-center justify-center rounded-full border px-1 sm:px-1.5',
                    'text-[9px] sm:text-[10px] font-bold tabular-nums transition-colors whitespace-nowrap',
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

  // Fetch tracker-recorded level-ups
  const { data: milestonesData, isLoading: milestonesLoading } = useSWR<{ milestones: MilestoneRow[] }>(
    `/api/player/${encodeURIComponent(username)}/milestones?limit=20`,
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

  // Skills at 99 that aren't in snapshot records
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
    <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-[1fr_280px]">

      {/* ── Left: Achievement Progress bars ──────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03]">
        <div className="flex items-center gap-2 border-b border-white/5 px-3 sm:px-4 py-2 sm:py-3">
          <span className="text-base">🏆</span>
          <h2 className="text-sm font-semibold text-slate-200">Achievement Progress</h2>
        </div>
        <div className="divide-y divide-white/[0.04] py-1 sm:py-2">
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
      <div className="space-y-3 sm:space-y-4">

        {/* Recent skill achievements */}
        <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03]">
          <div className="border-b border-white/5 px-3 sm:px-4 py-2 sm:py-3">
            <h3 className="text-sm font-semibold text-slate-200">Recent skill achievements</h3>
          </div>
          {achLoading ? (
            <div className="divide-y divide-white/[0.04] py-1 sm:py-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="mx-2 sm:mx-4 my-1 sm:my-2 h-8 sm:h-10 animate-pulse rounded-lg bg-white/5" style={{ animationDelay: `${i * 60}ms` }} />
              ))}
            </div>
          ) : displayRecent.length === 0 ? (
            <p className="px-3 sm:px-4 py-4 sm:py-6 text-center text-xs text-slate-500">No level 99s yet.</p>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {displayRecent.map((ach) => {
                const skillMeta = SKILLS.find((s) => s.id === ach.skillId);
                return (
                  <div key={ach.key} className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 transition hover:bg-white/[0.03] min-w-0">
                    {skillMeta ? (
                      <div className="relative h-5 w-5 sm:h-6 sm:w-6 shrink-0">
                        <Image src={getSkillIcon(skillMeta.icon)} alt={skillMeta.name} fill className="object-contain" unoptimized />
                      </div>
                    ) : (
                      <div className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-slate-200 truncate">{ach.label}</p>
                      {ach.completedAt ? (
                        <p className="text-[10px] sm:text-[11px] text-slate-500">
                          {new Date(ach.completedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      ) : (
                        <p className="text-[10px] sm:text-[11px] text-slate-600">Date not tracked</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Level-Ups (from tracker) */}
        <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03]">
          <div className="border-b border-white/5 px-3 sm:px-4 py-2 sm:py-3">
            <h3 className="text-sm font-semibold text-slate-200">Recent level-ups</h3>
          </div>
          {milestonesLoading ? (
            <div className="divide-y divide-white/[0.04] py-1 sm:py-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="mx-2 sm:mx-4 my-1 sm:my-2 h-8 sm:h-10 animate-pulse rounded-lg bg-white/5" style={{ animationDelay: `${i * 60}ms` }} />
              ))}
            </div>
          ) : !milestonesData?.milestones?.length ? (
            <p className="px-3 sm:px-4 py-4 sm:py-6 text-center text-xs text-slate-500">No level-ups recorded yet.</p>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {milestonesData.milestones.map((m) => {
                const skillMeta = SKILLS.find((s) => s.id === m.skill_id);
                return (
                  <div key={m.id} className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 transition hover:bg-white/[0.03] min-w-0">
                    {skillMeta ? (
                      <div className="relative h-5 w-5 sm:h-6 sm:w-6 shrink-0">
                        <Image src={getSkillIcon(skillMeta.icon)} alt={m.skill_name} fill className="object-contain" unoptimized />
                      </div>
                    ) : (
                      <div className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-slate-200 truncate">
                        {m.skill_name}
                        <span className="ml-1 text-slate-500 font-normal text-[10px] sm:text-xs">
                          {m.old_level} → <span className={m.new_level >= 99 ? 'text-amber-400 font-bold' : 'text-emerald-400 font-semibold'}>{m.new_level}</span>
                        </span>
                      </p>
                      <p className="text-[10px] sm:text-[11px] text-slate-500">
                        {new Date(m.achieved_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {' · '}
                        {formatXp(m.xp)} xp
                      </p>
                    </div>
                    {m.new_level >= 99 && (
                      <span className="shrink-0 text-[10px] sm:text-[11px] font-bold text-amber-400 border border-amber-500/30 bg-amber-500/10 rounded-full px-1.5 sm:px-2 py-0.5">99</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Nearest skill achievements */}
        <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03]">
          <div className="border-b border-white/5 px-3 sm:px-4 py-2 sm:py-3">
            <h3 className="text-sm font-semibold text-slate-200">Nearest skill achievements</h3>
          </div>          {nearestGoals.length === 0 ? (
            <p className="px-3 sm:px-4 py-4 sm:py-6 text-center text-xs text-slate-500">All goals completed!</p>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {nearestGoals.map((goal) => (
                <div key={goal.label} className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 transition hover:bg-white/[0.03] min-w-0">
                  {goal.icon ? (
                    <div className="relative h-5 w-5 sm:h-6 sm:w-6 shrink-0">
                      <Image src={getSkillIcon(goal.icon)} alt={goal.label} fill className="object-contain" unoptimized />
                    </div>
                  ) : (
                    <div className="flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center">
                      <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 6h18M3 14h12M3 18h8" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-slate-200 truncate">{goal.label}</p>
                    <p className="text-[10px] sm:text-[11px] text-slate-500">{fmtXpLeft(goal.xpLeft)} left</p>
                  </div>
                  <CircularProgress pct={goal.pct} size={40} />
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

// ─── Collection helpers ───────────────────────────────────────────────────────

function getItemRarityStyle(tier: CollectionLogItem['rarityTier']): {
  border: string;
  glow: string;
  dot: string;
  text: string;
  label: string;
  pulse: boolean;
} {
  switch (tier) {
    case 'mythic':    return { border: 'border-fuchsia-500/50', glow: 'shadow-[0_0_12px_rgba(217,70,239,0.20)]',  dot: 'bg-fuchsia-400', text: 'text-fuchsia-300', label: 'Mythic',    pulse: true  };
    case 'legendary': return { border: 'border-rose-500/50',    glow: 'shadow-[0_0_12px_rgba(244,63,94,0.20)]',   dot: 'bg-rose-400',    text: 'text-rose-300',    label: 'Legendary', pulse: true  };
    case 'epic':      return { border: 'border-violet-500/45',  glow: 'shadow-[0_0_12px_rgba(139,92,246,0.18)]',  dot: 'bg-violet-400',  text: 'text-violet-300',  label: 'Epic',      pulse: false };
    case 'rare':      return { border: 'border-amber-500/45',   glow: 'shadow-[0_0_12px_rgba(245,158,11,0.18)]',  dot: 'bg-amber-400',   text: 'text-amber-300',   label: 'Rare',      pulse: false };
    case 'uncommon':  return { border: 'border-sky-400/40',     glow: 'shadow-[0_0_8px_rgba(56,189,248,0.14)]',   dot: 'bg-sky-400',     text: 'text-sky-300',     label: 'Uncommon',  pulse: false };
    case 'common':    return { border: 'border-white/[0.09]',   glow: '',                                          dot: 'bg-slate-500',   text: 'text-slate-400',   label: 'Common',    pulse: false };
    default:          return { border: 'border-white/[0.07]',   glow: '',                                          dot: 'bg-slate-600',   text: 'text-slate-500',   label: 'Unknown',   pulse: false };
  }
}

function getCollectionGroupName(label: string, items: CollectionLogItem[]): string {
  if (items.length > 0 && items.every((i) => i.eventType === 'PET_OBTAINED')) return 'Pets';
  const l = label.toLowerCase();
  if (/clue|casket|mimic/.test(l)) return 'Clues';
  if (/chamber|theatre|tomb|raid/.test(l)) return 'Raids';
  if (/wilderness|revenant|wildy/.test(l)) return 'Wilderness';
  if (/gauntlet|corrupted|tempoross|wintertodt|zalcano|soul war|castle|barbarian|pest|gotr/.test(l)) return 'Minigames';
  return 'Bosses';
}

const COL_GROUP_ORDER = ['Raids', 'Bosses', 'Wilderness', 'Pets', 'Clues', 'Minigames'];

const SKILLING_PETS = new Set([
  'baby chinchompa', 'beaver', 'giant squirrel', 'herbi', 'heron',
  'rift guardian', 'rock golem', 'rocky', 'tangleroot', 'tiny tempor', 'quetzin',
]);

const OTHER_PETS = new Set([
  'abyssal orphan', 'bloodhound', 'chompy chick', 'phoenix', 'smolcano',
  'penance queen', "kril's child", 'sweeper',
]);

function getPetSubGroup(itemName: string): 'Boss' | 'Skilling' | 'Other' {
  const n = itemName.toLowerCase();
  if (SKILLING_PETS.has(n)) return 'Skilling';
  if (OTHER_PETS.has(n)) return 'Other';
  return 'Boss';
}

const PET_SUB_ORDER = ['Boss', 'Skilling', 'Other'] as const;
type PetSubGroup = (typeof PET_SUB_ORDER)[number];

type SortKey = 'date' | 'kc' | 'count' | 'name';

const NEW_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
// Module-level snapshot: avoids React Compiler "impure function in render" error
const COLLECTION_LOG_NOW_MS = Date.now();
function isNewItem(lastObtainedAt: string | null): boolean {
  if (!lastObtainedAt) return false;
  return COLLECTION_LOG_NOW_MS - new Date(lastObtainedAt).getTime() < NEW_THRESHOLD_MS;
}

type CollectionDisplayRow = { item: CollectionLogItem; categoryKey: string; categoryLabel: string };

function CollectionLogPanel({ username }: { username: string }) {
  const sk = `ferox:cl:${username.toLowerCase()}`;

  const [selectedKey, setSelectedKey] = useState<string>(() => {
    if (typeof window === 'undefined') return '__recent__';
    return window.localStorage.getItem(`${sk}:sel`) ?? '__recent__';
  });
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    if (typeof window === 'undefined') return 'grid';
    return window.localStorage.getItem(`${sk}:view`) === 'table' ? 'table' : 'grid';
  });
  const [openGroups, setOpenGroups] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(`${sk}:groups`);
      if (raw) {
        const p = JSON.parse(raw) as unknown;
        if (Array.isArray(p) && p.every((x): x is string => typeof x === 'string')) return p;
      }
    } catch { /* ignore */ }
    return [];
  });
  const [sidebarQuery, setSidebarQuery] = useState('');
  const [itemQuery, setItemQuery]       = useState('');
  const [sortBy, setSortBy]             = useState<SortKey>('date');
  const [selectedCard, setSelectedCard] = useState<{ item: CollectionLogItem; categoryLabel: string } | null>(null);
  const deferredItemQuery    = useDeferredValue(itemQuery.trim().toLowerCase());
  const deferredSidebarQuery = useDeferredValue(sidebarQuery.trim().toLowerCase());
  const defaultsAppliedRef   = useRef(false);

  // Close detail card on Escape
  useEffect(() => {
    if (!selectedCard) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedCard(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedCard]);

  const { data, isLoading } = useSWR<CollectionLogResponse>(
    `/api/player/${encodeURIComponent(username)}/collection-log`,
    fetcher,
  );

  // ── Persist ──────────────────────────────────────────────────────────────────
  useEffect(() => { try { window.localStorage.setItem(`${sk}:sel`,    selectedKey);                } catch { /* ignore */ } }, [sk, selectedKey]);
  useEffect(() => { try { window.localStorage.setItem(`${sk}:view`,   viewMode);                   } catch { /* ignore */ } }, [sk, viewMode]);
  useEffect(() => { try { window.localStorage.setItem(`${sk}:groups`, JSON.stringify(openGroups)); } catch { /* ignore */ } }, [sk, openGroups]);

  // ── Derived ───────────────────────────────────────────────────────────────────
  const recentRows = useMemo<CollectionDisplayRow[]>(() => {
    return (data?.categories ?? [])
      .flatMap((cat) => cat.items.map((item) => ({ item, categoryKey: cat.key, categoryLabel: cat.label })))
      .sort((a, b) => (b.item.lastObtainedAt ?? '').localeCompare(a.item.lastObtainedAt ?? ''));
  }, [data?.categories]);

  const categoryGroups = useMemo<[string, CollectionLogCategory[]][]>(() => {
    const cats = data?.categories ?? [];
    const filtered = deferredSidebarQuery
      ? cats.filter((c) => c.label.toLowerCase().includes(deferredSidebarQuery))
      : cats;
    const map = new Map<string, CollectionLogCategory[]>();
    for (const cat of filtered) {
      const g = getCollectionGroupName(cat.label, cat.items);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(cat);
    }
    return [...map.entries()].sort(([a], [b]) => {
      const ai = COL_GROUP_ORDER.indexOf(a);
      const bi = COL_GROUP_ORDER.indexOf(b);
      if (ai < 0 && bi < 0) return a.localeCompare(b);
      if (ai < 0) return 1;
      if (bi < 0) return -1;
      return ai - bi;
    });
  }, [data?.categories, deferredSidebarQuery]);

  // Auto-open first group when data loads and no group preference exists
  useEffect(() => {
    if (defaultsAppliedRef.current || categoryGroups.length === 0) return;
    defaultsAppliedRef.current = true;
    setOpenGroups((prev) => (prev.length > 0 ? prev : [categoryGroups[0]![0]]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryGroups.length]);

  const petCategories = useMemo(
    () => (data?.categories ?? []).filter((c) => c.items.length > 0 && c.items.every((i) => i.eventType === 'PET_OBTAINED')),
    [data?.categories],
  );

  const petSubGroupRows = useMemo<Record<PetSubGroup, CollectionDisplayRow[]>>(() => {
    const all = petCategories.flatMap((cat) =>
      cat.items.map((item) => ({ item, categoryKey: cat.key, categoryLabel: cat.label })),
    );
    const groups: Record<PetSubGroup, CollectionDisplayRow[]> = { Boss: [], Skilling: [], Other: [] };
    for (const row of all) groups[getPetSubGroup(row.item.name)].push(row);
    for (const g of PET_SUB_ORDER) groups[g].sort((a, b) => a.item.name.localeCompare(b.item.name));
    return groups;
  }, [petCategories]);

  const activePetSubGroup: PetSubGroup | null = selectedKey.startsWith('__pets:')
    ? (selectedKey.slice(7, -2) as PetSubGroup)
    : null;

  const selectedCategory = useMemo(
    () =>
      selectedKey === '__recent__' || selectedKey.startsWith('__pets:')
        ? null
        : (data?.categories.find((c) => c.key === selectedKey) ?? null),
    [data?.categories, selectedKey],
  );

  const displayRows = useMemo<CollectionDisplayRow[]>(() => {
    function applySort(rows: CollectionDisplayRow[]): CollectionDisplayRow[] {
      if (sortBy === 'date') return rows; // already sorted by date from source
      return [...rows].sort((a, b) => {
        if (sortBy === 'kc') return (a.item.firstKc ?? Infinity) - (b.item.firstKc ?? Infinity);
        if (sortBy === 'count') return b.item.obtainedCount - a.item.obtainedCount;
        return a.item.name.localeCompare(b.item.name);
      });
    }
    if (selectedKey === '__recent__') {
      const rows = deferredItemQuery
        ? recentRows.filter(
            (r) =>
              r.item.name.toLowerCase().includes(deferredItemQuery) ||
              r.categoryLabel.toLowerCase().includes(deferredItemQuery),
          )
        : recentRows;
      return applySort(rows.slice(0, 250));
    }
    if (selectedKey.startsWith('__pets:')) {
      const sub = selectedKey.slice(7, -2) as PetSubGroup;
      const rows = petSubGroupRows[sub] ?? [];
      return applySort(deferredItemQuery
        ? rows.filter((r) => r.item.name.toLowerCase().includes(deferredItemQuery))
        : rows);
    }
    if (!selectedCategory) return [];
    const items = deferredItemQuery
      ? selectedCategory.items.filter((i) => i.name.toLowerCase().includes(deferredItemQuery))
      : selectedCategory.items;
    return applySort(items.map((item) => ({
      item,
      categoryKey: selectedCategory.key,
      categoryLabel: selectedCategory.label,
    })));
  }, [selectedKey, selectedCategory, petSubGroupRows, recentRows, deferredItemQuery, sortBy]);

  // ── Unseen items (known drops/pets not yet obtained by this player) ────────
  const unseenItems = useMemo<{ name: string; imageUrl: string; isPet: boolean }[]>(() => {
    if (!selectedCategory) return [];
    const obtainedNames = new Set(
      selectedCategory.items.map((i) => i.name.toLowerCase()),
    );
    const toSlug = (n: string) => { const t = n.trim(); return (t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()).replace(/\s+/g, '_'); };
    const drops = (selectedCategory.knownDrops ?? [])
      .filter((d) => !obtainedNames.has(d.toLowerCase()))
      .map((d) => ({
        name: d,
        imageUrl: `/items/${toSlug(d)}.png`,
        isPet: false,
      }));
    const pets = (selectedCategory.knownPets ?? [])
      .filter((p) => !obtainedNames.has(p.toLowerCase()))
      .map((p) => ({
        name: p,
        imageUrl: `/collection_logs/${toSlug(p)}.png`,
        isPet: true,
      }));
    return [...drops, ...pets];
  }, [selectedCategory]);

  function toggleGroup(g: string) {
    setOpenGroups((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="animate-fade-in overflow-hidden rounded-2xl border border-white/[0.06]">
        <div className="flex" style={{ minHeight: 520 }}>
          <div className="w-[172px] shrink-0 space-y-1 border-r border-white/[0.05] p-3">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-6 animate-pulse rounded-lg bg-white/[0.04]" style={{ animationDelay: `${i * 30}ms` }} />
            ))}
          </div>
          <div className="flex-1 p-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(40px, 1fr))', gap: 3, alignContent: 'start' }}>
            {[...Array(48)].map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-lg bg-white/[0.04]" style={{ animationDelay: `${i * 12}ms` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Error / unconfigured / empty ──────────────────────────────────────────────
  if (!data || data.error) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-2xl border border-red-500/15 bg-gradient-to-b from-red-500/[0.06] to-transparent px-8 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10">
          <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-red-300">Collection log unavailable</p>
          <p className="mt-1 text-xs text-red-200/55">The server could not load drop history for this player.</p>
        </div>
      </div>
    );
  }

  if (!data.configured) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent px-8 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
          <svg className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-300">Collection log not configured</p>
          <p className="mt-1 text-xs text-slate-600">{data.message ?? 'Import the PVM events dataset to enable this tab.'}</p>
        </div>
      </div>
    );
  }

  if (data.categories.length === 0) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent px-8 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-500/20 bg-amber-500/[0.07]">
          <svg className="h-5 w-5 text-amber-400/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-300">No collection log entries yet</p>
          <p className="mt-1 text-xs text-slate-600">Rare drops and pets will appear here once found in the tracker data.</p>
        </div>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-2.5 animate-fade-in">

      {/* ── Stats ribbon ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border border-white/[0.06] bg-[hsl(220_23%_11%)] px-4 py-2.5">
        <span className="text-[10px] uppercase tracking-widest text-slate-600">
          Unique&nbsp;<span className="font-bold tabular-nums text-amber-300">{data.summary.totalItems}</span>
        </span>
        <span className="hidden h-3.5 w-px bg-white/[0.07] sm:block" />
        <span className="text-[10px] uppercase tracking-widest text-slate-600">
          Sources&nbsp;<span className="font-bold tabular-nums text-sky-300">{data.summary.totalCategories}</span>
        </span>
        <span className="hidden h-3.5 w-px bg-white/[0.07] sm:block" />
        <span className="text-[10px] uppercase tracking-widest text-slate-600">
          Drops&nbsp;<span className="font-bold tabular-nums text-emerald-300">{data.summary.totalEvents}</span>
        </span>
        {data.summary.lastObtainedAt && (
          <>
            <span className="hidden h-3.5 w-px bg-white/[0.07] sm:block" />
            <span className="text-[10px] text-slate-700">
              Last:&nbsp;<span className="text-slate-500">{formatRelativeTime(data.summary.lastObtainedAt)}</span>
              &nbsp;·&nbsp;
              <span className="text-slate-600">{formatCalendarDate(data.summary.lastObtainedAt)}</span>
            </span>
          </>
        )}
      </div>

      {/* ── Recent unlock strip ───────────────────────────────────────────── */}
      {recentRows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-[hsl(220_23%_11%)]">
          <p className="border-b border-white/[0.04] px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-600">
            Recent Unlocks
          </p>
          <div className="flex gap-2 overflow-x-auto p-2 scrollbar-hide">
            {recentRows.slice(0, 10).map(({ item, categoryKey, categoryLabel }) => {
              const rs = getItemRarityStyle(item.rarityTier);
              return (
                <button
                  key={`${categoryKey}:${item.key}`}
                  onClick={() => {
                    const isPet = item.eventType === 'PET_OBTAINED';
                    setSelectedKey(isPet ? `__pets:${getPetSubGroup(item.name)}__` : categoryKey);
                    if (!isPet) {
                      const g = getCollectionGroupName(categoryLabel, [item]);
                      setOpenGroups((prev) => (prev.includes(g) ? prev : [...prev, g]));
                    }
                  }}
                  className="flex shrink-0 items-center gap-2 rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-1.5 text-left transition-colors hover:border-white/[0.12] hover:bg-black/30"
                >
                  <div className={`h-6 w-6 shrink-0 overflow-hidden rounded-md border ${rs.border} bg-black/40 p-0.5`}>
                    <img
                      src={item.imageUrl ?? ''}
                      alt={item.name}
                      className="h-full w-full object-contain"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold leading-tight text-slate-200">{item.name}</p>
                    <p className="text-[10px] leading-tight text-slate-600">
                      {categoryLabel}&nbsp;·&nbsp;{item.lastObtainedAt ? formatRelativeTime(item.lastObtainedAt) : '—'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Two-panel layout ──────────────────────────────────────────────── */}
      <div className="flex overflow-hidden rounded-2xl border border-white/[0.06]" style={{ minHeight: 540 }}>

        {/* Left sidebar */}
        <aside className="flex w-[172px] shrink-0 flex-col border-r border-white/[0.06] bg-[hsl(220_23%_11%)]">

          {/* All Recent row */}
          <button
            onClick={() => setSelectedKey('__recent__')}
            className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors ${
              selectedKey === '__recent__'
                ? 'border-l-2 border-sky-500 bg-sky-600/10 pl-[10px]'
                : 'border-l-2 border-transparent text-slate-400 hover:bg-white/[0.03] hover:text-slate-200'
            }`}
          >
            <span className={`text-[11px] font-semibold ${selectedKey === '__recent__' ? 'text-sky-300' : ''}`}>
              All Recent
            </span>
            <span className={`shrink-0 rounded px-1 py-0.5 text-[10px] tabular-nums ${selectedKey === '__recent__' ? 'bg-sky-600/25 text-sky-300' : 'bg-white/[0.04] text-slate-600'}`}>
              {recentRows.length}
            </span>
          </button>

          <div className="mx-3 border-t border-white/[0.05]" />

          {/* Category search */}
          <div className="px-2 py-1.5">
            <input
              value={sidebarQuery}
              onChange={(e) => setSidebarQuery(e.target.value)}
              placeholder="Filter categories…"
              className="w-full rounded-lg border border-white/[0.06] bg-black/30 px-2.5 py-1 text-[11px] text-slate-300 outline-none placeholder:text-slate-700 focus:border-sky-500/40"
            />
          </div>

          {/* Groups */}
          <div className="flex-1 overflow-y-auto pb-2">
            {categoryGroups.map(([group, cats]) => {
              // Pets → collapsible group with Boss / Skilling / Other sub-rows
              if (group === 'Pets') {
                const petTotal = cats.reduce((s, c) => s + c.itemCount, 0);
                const isPetsOpen = openGroups.includes('Pets') || !!deferredSidebarQuery;
                return (
                  <div key="Pets">
                    <button
                      onClick={() => toggleGroup('Pets')}
                      className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left transition-colors hover:bg-white/[0.03]"
                    >
                      <svg
                        className={`h-2.5 w-2.5 shrink-0 text-slate-600 transition-transform duration-150 ${isPetsOpen ? 'rotate-90' : ''}`}
                        fill="currentColor"
                        viewBox="0 0 8 8"
                      >
                        <path d="M2 1l4 3-4 3V1z" />
                      </svg>
                      <span className="flex-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Pets</span>
                      <span className="text-[10px] tabular-nums text-slate-700">{petTotal}</span>
                    </button>
                    {isPetsOpen && (
                      <div>
                        {PET_SUB_ORDER.map((sub) => {
                          const count = petSubGroupRows[sub].length;
                          if (count === 0) return null;
                          const subKey = `__pets:${sub}__`;
                          return (
                            <button
                              key={subKey}
                              onClick={() => setSelectedKey(subKey)}
                              className={`flex w-full items-center gap-2 py-1 pr-3 text-left text-[11px] transition-colors ${
                                selectedKey === subKey
                                  ? 'border-l-2 border-sky-500 bg-sky-600/10 pl-[18px] text-sky-300'
                                  : 'border-l-2 border-transparent pl-5 text-slate-400 hover:bg-white/[0.03] hover:text-slate-200'
                              }`}
                            >
                              <span className="flex-1 truncate">{sub}</span>
                              <span className={`shrink-0 text-[10px] tabular-nums ${selectedKey === subKey ? 'text-sky-400' : 'text-slate-700'}`}>
                                {count}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              const isOpen = openGroups.includes(group) || !!deferredSidebarQuery;
              const groupTotal = cats.reduce((s, c) => s + c.itemCount, 0);
              return (
                <div key={group}>
                  <button
                    onClick={() => toggleGroup(group)}
                    className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left transition-colors hover:bg-white/[0.03]"
                  >
                    <svg
                      className={`h-2.5 w-2.5 shrink-0 text-slate-600 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}
                      fill="currentColor"
                      viewBox="0 0 8 8"
                    >
                      <path d="M2 1l4 3-4 3V1z" />
                    </svg>
                    <span className="flex-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">{group}</span>
                    <span className="text-[10px] tabular-nums text-slate-700">{groupTotal}</span>
                  </button>

                  {isOpen && (
                    <div>
                      {cats.map((cat) => (
                        <button
                          key={cat.key}
                          onClick={() => setSelectedKey(cat.key)}
                          className={`flex w-full items-center gap-2 py-1 pr-3 text-left text-[11px] transition-colors ${
                            selectedKey === cat.key
                              ? 'border-l-2 border-sky-500 bg-sky-600/10 pl-[18px] text-sky-300'
                              : 'border-l-2 border-transparent pl-5 text-slate-400 hover:bg-white/[0.03] hover:text-slate-200'
                          }`}
                        >
                          <div className="flex w-full items-center gap-2">
                            <span className="flex-1 truncate">{cat.label}</span>
                            <span className={`shrink-0 text-[10px] tabular-nums ${selectedKey === cat.key ? 'text-sky-400' : 'text-slate-700'}`}>
                              {cat.itemCount}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* Right content panel */}
        <div className="flex min-w-0 flex-1 flex-col bg-[hsl(220_23%_9%)]">

          {/* Panel header */}
          <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-white/[0.05] bg-[hsl(220_23%_10%)] px-4 py-2.5">
            <div className="min-w-0 flex-1">
              {selectedCategory ? (
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-100">{selectedCategory.label}</h3>
                  {selectedCategory.maxKills != null && (
                    <span className="rounded-md border border-amber-500/20 bg-amber-500/[0.08] px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-amber-400">
                      KC {formatNumber(selectedCategory.maxKills)}
                    </span>
                  )}
                  <span className="text-[11px] text-slate-600">
                    {selectedCategory.itemCount} {selectedCategory.itemCount === 1 ? 'item' : 'items'} · {selectedCategory.eventCount} {selectedCategory.eventCount === 1 ? 'drop' : 'drops'}
                  </span>
                  {selectedCategory.lastObtainedAt && (
                    <span className="text-[11px] text-slate-700">last {formatRelativeTime(selectedCategory.lastObtainedAt)}</span>
                  )}
                </div>
              ) : activePetSubGroup ? (
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-100">{activePetSubGroup} Pets</h3>
                  <span className="text-[11px] text-slate-600">
                    {petSubGroupRows[activePetSubGroup].length} {petSubGroupRows[activePetSubGroup].length === 1 ? 'pet' : 'pets'}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-100">All Recent</h3>
                  <span className="text-[11px] text-slate-600">
                    {recentRows.length} items · {data.summary.totalCategories} sources
                  </span>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex shrink-0 items-center gap-2">
              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="rounded-lg border border-white/[0.06] bg-black/30 py-1 pl-2 pr-6 text-[11px] text-slate-300 outline-none focus:border-sky-500/40 appearance-none cursor-pointer"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2364748b'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}
              >
                <option value="date">Date</option>
                <option value="kc">KC</option>
                <option value="count">Count</option>
                <option value="name">Name</option>
              </select>
              <label className="relative">
                <svg
                  className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
                </svg>
                <input
                  value={itemQuery}
                  onChange={(e) => setItemQuery(e.target.value)}
                  placeholder="Search…"
                  className="w-24 rounded-lg border border-white/[0.06] bg-black/30 py-1 pl-6 pr-2.5 text-[11px] text-slate-300 outline-none placeholder:text-slate-700 transition-all duration-200 focus:w-36 focus:border-sky-500/40"
                />
              </label>
              <div className="flex overflow-hidden rounded-lg border border-white/[0.06]">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-2.5 py-1 text-[11px] transition-colors ${viewMode === 'grid' ? 'bg-sky-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Grid
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-2.5 py-1 text-[11px] transition-colors ${viewMode === 'table' ? 'bg-sky-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  List
                </button>
              </div>
            </div>
          </div>

          {/* Items area */}
          <div className="flex-1 overflow-auto">
            {displayRows.length === 0 ? (
              <div className="flex min-h-[200px] items-center justify-center">
                <p className="text-xs text-slate-700">No items found</p>
              </div>

            ) : viewMode === 'table' ? (
              /* ── List / table view ─────────────────────────────────────── */
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-[hsl(220_23%_10%)]">
                  <tr className="border-b border-white/[0.05]">
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Item</th>
                    {selectedKey === '__recent__' && (
                      <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-600">Source</th>
                    )}
                    <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Type</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">KC</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Count</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-slate-600">Last</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {displayRows.map(({ item, categoryKey, categoryLabel }, idx) => {
                    const rs = getItemRarityStyle(item.rarityTier);
                    const fresh = isNewItem(item.lastObtainedAt);
                    return (
                      <motion.tr
                        key={`${categoryKey}:${item.key}`}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.15, delay: Math.min(idx * 0.015, 0.4) }}
                        className="cursor-pointer transition-colors hover:bg-white/[0.02]"
                        onClick={() => setSelectedCard({ item, categoryLabel })}
                      >
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2.5">
                            <div className={`h-5 w-5 shrink-0 overflow-hidden rounded-md border ${rs.border} bg-black/40 p-0.5`}>
                              <img
                                src={item.imageUrl ?? ''}
                                alt={item.name}
                                className="h-full w-full object-contain"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                            </div>
                            <span className="font-semibold text-slate-100">{item.name}</span>
                            {fresh && (
                              <span className="rounded bg-sky-500/20 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-400">new</span>
                            )}
                          </div>
                        </td>
                        {selectedKey === '__recent__' && (
                          <td className="px-3 py-2 text-slate-500">{categoryLabel}</td>
                        )}
                        <td className={`px-3 py-2 text-right font-medium ${item.eventType === 'PET_OBTAINED' ? 'text-violet-400' : 'text-sky-400'}`}>
                          {item.eventType === 'PET_OBTAINED' ? 'Pet' : 'Drop'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-amber-400">
                          {item.firstKc != null ? item.firstKc.toLocaleString() : <span className="text-slate-700">—</span>}
                        </td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums text-emerald-400">{item.obtainedCount}×</td>
                        <td className="px-4 py-2 text-right tabular-nums text-slate-600">{formatCalendarDate(item.lastObtainedAt)}</td>
                      </motion.tr>
                    );
                  })}
                  {/* ── Unseen / not-yet-obtained items ────────────────── */}
                  {unseenItems.map((u) => (
                    <tr key={`unseen:${u.name}`} className="opacity-35">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2.5">
                          <div className="h-5 w-5 shrink-0 overflow-hidden rounded-md border border-white/10 bg-black/40 p-0.5 grayscale">
                            <img
                              src={u.imageUrl}
                              alt={u.name}
                              className="h-full w-full object-contain"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          </div>
                          <span className="font-semibold text-slate-400">{u.name}</span>
                        </div>
                      </td>
                      {selectedKey === '__recent__' && <td />}
                      <td className="px-3 py-2 text-right font-medium text-slate-600">{u.isPet ? 'Pet' : 'Drop'}</td>
                      <td className="px-3 py-2 text-right text-slate-700">—</td>
                      <td className="px-3 py-2 text-right text-slate-700">0×</td>
                      <td className="px-4 py-2 text-right text-slate-700">—</td>
                    </tr>
                  ))}
                </tbody>
              </table>

            ) : (
              /* ── Compact grid view ─────────────────────────────────────── */
              <div
                className="p-2.5"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(40px, 1fr))', gap: 3 }}
              >
                {displayRows.map(({ item, categoryKey, categoryLabel }, idx) => {
                  const rs = getItemRarityStyle(item.rarityTier);
                  const fresh = isNewItem(item.lastObtainedAt);
                  return (
                    <motion.article
                      key={`${categoryKey}:${item.key}`}
                      initial={{ opacity: 0, scale: 0.82 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.18, delay: Math.min(idx * 0.012, 0.55), ease: 'easeOut' }}
                      onClick={() => setSelectedCard({ item, categoryLabel })}
                      className={`group relative cursor-pointer overflow-hidden rounded-lg border ${rs.border} ${rs.glow} bg-black/40 transition-all duration-150 hover:z-10 hover:scale-[1.12] hover:brightness-[1.15]`}
                    >
                      <div className="relative aspect-square">
                        <img
                          src={item.imageUrl ?? ''}
                          alt={item.name}
                          className="h-full w-full object-contain p-[3px]"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                        {/* Rarity dot */}
                        <span className={`absolute right-[3px] top-[3px] h-[5px] w-[5px] rounded-full ${rs.dot} ${rs.pulse ? 'animate-pulse' : ''}`} />
                        {/* Obtained count */}
                        {item.obtainedCount > 1 && (
                          <span className="absolute bottom-0 right-0 rounded-tl bg-black/80 px-[3px] py-px text-[8px] font-bold leading-tight tabular-nums text-emerald-400">
                            {item.obtainedCount}
                          </span>
                        )}
                        {/* New badge */}
                        {fresh && (
                          <span className="absolute bottom-0 left-0 rounded-tr bg-sky-500/90 px-[3px] py-px text-[7px] font-bold uppercase leading-tight tracking-wide text-white">
                            new
                          </span>
                        )}
                        {/* Pet badge */}
                        {item.eventType === 'PET_OBTAINED' && (
                          <span className="absolute left-0 top-0 rounded-br bg-violet-600/80 px-[3px] py-px text-[8px] font-bold leading-tight text-white">P</span>
                        )}
                      </div>
                      {/* Item name */}
                      <p className="truncate bg-black/30 px-0.5 pb-0.5 pt-px text-center text-[8px] leading-tight text-slate-600 group-hover:text-slate-300">
                        {item.name}
                      </p>
                    </motion.article>
                  );
                })}
                {/* ── Unseen / not-yet-obtained items ────────────────── */}
                {unseenItems.map((u) => (
                  <article
                    key={`unseen:${u.name}`}
                    title={u.name}
                    className="group relative overflow-hidden rounded-lg border border-white/[0.06] bg-black/20 opacity-30 grayscale"
                  >
                    <div className="relative aspect-square">
                      <img
                        src={u.imageUrl}
                        alt={u.name}
                        className="h-full w-full object-contain p-[3px]"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                      {u.isPet && (
                        <span className="absolute left-0 top-0 rounded-br bg-violet-600/50 px-[3px] py-px text-[8px] font-bold leading-tight text-white/60">P</span>
                      )}
                    </div>
                    <p className="truncate bg-black/30 px-0.5 pb-0.5 pt-px text-center text-[8px] leading-tight text-slate-600">
                      {u.name}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Item detail modal ─────────────────────────────────── */}
      <AnimatePresence>
        {selectedCard && (() => {
          const { item, categoryLabel } = selectedCard;
          const rs = getItemRarityStyle(item.rarityTier);
          const fresh = isNewItem(item.lastObtainedAt);

          // Obtained timeline
          const firstMs = item.firstObtainedAt ? new Date(item.firstObtainedAt).getTime() : null;
          const lastMs  = item.lastObtainedAt  ? new Date(item.lastObtainedAt).getTime()  : null;
          const spanMs  = firstMs != null && lastMs != null && lastMs > firstMs ? lastMs - firstMs : null;

          // Rarity gradient color
          const rarityGradient: Record<string, string> = {
            mythic:    'from-fuchsia-900/30',
            legendary: 'from-rose-900/30',
            epic:      'from-violet-900/25',
            rare:      'from-amber-900/20',
            uncommon:  'from-sky-900/20',
            common:    'from-slate-800/10',
            unknown:   'from-slate-800/10',
          };
          const gradFrom = rarityGradient[item.rarityTier] ?? 'from-slate-800/10';

          return (
            <motion.div
              key="modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              onClick={() => setSelectedCard(null)}
            >
              {/* backdrop */}
              <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
              {/* card */}
              <motion.div
                key="modal-card"
                initial={{ scale: 0.88, opacity: 0, y: 12 }}
                animate={{ scale: 1,    opacity: 1, y: 0  }}
                exit={{    scale: 0.92, opacity: 0, y: 8  }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className={`relative w-full max-w-sm overflow-hidden rounded-2xl border ${rs.border} ${rs.glow} bg-[hsl(220_23%_11%)] shadow-2xl`}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Rarity gradient wash */}
                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-b ${gradFrom} to-transparent`} />

                {/* Close button */}
                <button
                  onClick={() => setSelectedCard(null)}
                  className="absolute right-3 top-3 z-10 rounded-full bg-black/40 p-1 text-slate-500 transition-colors hover:text-slate-200"
                  aria-label="Close"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                {/* Header band */}
                <div className="relative flex items-center gap-4 border-b border-white/[0.06] px-5 py-4">
                  <div className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border ${rs.border} bg-black/50 p-1.5`}>
                    <img
                      src={item.imageUrl ?? ''}
                      alt={item.name}
                      className="h-full w-full object-contain"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-bold leading-snug text-slate-100">{item.name}</h4>
                      {fresh && (
                        <span className="rounded bg-sky-500/25 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-400">new</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{categoryLabel}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${rs.text} bg-black/40 ${rs.border}`}>
                        {rs.label}
                      </span>
                      <span className={`rounded-md border border-white/[0.06] bg-black/40 px-1.5 py-0.5 text-[10px] font-semibold ${item.eventType === 'PET_OBTAINED' ? 'text-violet-400' : 'text-sky-400'}`}>
                        {item.eventType === 'PET_OBTAINED' ? 'Pet' : 'Drop'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stats grid */}
                <dl className="relative grid grid-cols-2 divide-x divide-y divide-white/[0.05]">
                  <div className="px-5 py-3">
                    <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Kill Count</dt>
                    <dd className="mt-1 text-sm font-semibold tabular-nums text-amber-400">
                      {item.firstKc != null
                        ? item.firstKc === item.lastKc || item.lastKc == null
                          ? `KC ${item.firstKc.toLocaleString()}`
                          : `KC ${item.firstKc.toLocaleString()} – ${item.lastKc.toLocaleString()}`
                        : '—'}
                    </dd>
                  </div>
                  <div className="px-5 py-3">
                    <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Times Obtained</dt>
                    <dd className="mt-1 text-sm font-bold tabular-nums text-emerald-400">{item.obtainedCount}×</dd>
                  </div>
                  <div className="px-5 py-3">
                    <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-600">First Obtained</dt>
                    <dd className="mt-1 text-sm tabular-nums text-slate-300">{formatCalendarDate(item.firstObtainedAt)}</dd>
                  </div>
                  <div className="px-5 py-3">
                    <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Last Obtained</dt>
                    <dd className="mt-1 text-sm tabular-nums text-slate-300">{formatCalendarDate(item.lastObtainedAt)}</dd>
                  </div>
                </dl>

                {/* Obtained timeline */}
                {firstMs != null && lastMs != null && (
                  <div className="relative border-t border-white/[0.05] px-5 py-3">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-600">Obtained Timeline</p>
                    <div className="relative h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                      {spanMs != null && spanMs > 0 ? (
                        <motion.div
                          className={`absolute left-0 top-0 h-full rounded-full ${rs.dot}`}
                          initial={{ width: '0%' }}
                          animate={{ width: `${Math.max(4, Math.round((spanMs / (COLLECTION_LOG_NOW_MS - firstMs)) * 100))}%` }}
                          transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
                        />
                      ) : (
                        <div className={`h-full w-1 rounded-full ${rs.dot}`} />
                      )}
                    </div>
                    <div className="mt-1.5 flex justify-between">
                      <span className="text-[9px] tabular-nums text-slate-700">{formatCalendarDate(item.firstObtainedAt)}</span>
                      <span className="text-[9px] tabular-nums text-slate-700">{formatCalendarDate(item.lastObtainedAt)}</span>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
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
  const [tab, setTab] = useState<'skills' | 'collection' | 'achievements' | 'gains' | 'records' | 'groups' | 'screenshot'>('skills');
  const [tabMenuOpen, setTabMenuOpen] = useState(false);
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
      ? `/api/top-gains?period=${gainPeriod}&limit=50&username=${encodeURIComponent(username)}`
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
    if (!topGainsData) return null;
    if (topGainsData.rank !== null && topGainsData.rank !== undefined) return topGainsData.rank;
    if (!topGainsData.gains) return null;
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
          <p className="text-4xl mb-4">⚠ï¸</p>
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
    { key: 'collection', label: 'Collection Log' },
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
          <div className="relative shrink-0">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-black/60 shadow-lg">
              <span className="bg-gradient-to-br from-amber-400 via-sky-400 to-purple-500 bg-clip-text text-xl font-black text-transparent">
                {displayName.slice(0, 2).toUpperCase()}
              </span>
            </div>
            {data.country && (
              <img
                src={`https://flagcdn.com/w20/${data.country.toLowerCase()}.png`}
                srcSet={`https://flagcdn.com/w40/${data.country.toLowerCase()}.png 2x`}
                width={16}
                height={12}
                alt={data.country}
                title={data.country}
                className="absolute bottom-0.5 right-0.5 rounded-sm object-cover shadow shadow-black/60 ring-1 ring-black/50"
              />
            )}
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
      {/* Mobile: hamburger dropdown */}
      <div className="relative sm:hidden">
        <button
          onClick={() => setTabMenuOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white"
        >
          <span>{TABS.find((t) => t.key === tab)?.label ?? 'Menu'}</span>
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${tabMenuOpen ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {tabMenuOpen && (
          <div className="absolute top-full mt-1 left-0 right-0 z-40 rounded-xl border border-white/10 bg-[#17151f] shadow-2xl overflow-hidden">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setTabMenuOpen(false); }}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium text-left transition ${
                  tab === t.key
                    ? 'text-sky-400 bg-sky-500/10'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {/* Desktop: horizontal tabs */}
      <div className="hidden sm:flex gap-1 rounded-xl border border-white/5 bg-white/[0.03] p-1">
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

      {/* ── Collection Log Tab ────────────────────────────────────────────── */}
      {tab === 'collection' && (
        <CollectionLogPanel username={username} />
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
