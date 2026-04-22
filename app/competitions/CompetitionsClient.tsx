'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';

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

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const METRIC_EMOJI: Record<string, string> = {
  overall: '⚔️', attack: '🗡️', defence: '🛡️', strength: '💪', hitpoints: '❤️',
  ranged: '🏹', prayer: '🙏', magic: '🔮', cooking: '🍳', woodcutting: '🪓',
  fletching: '🪃', fishing: '🎣', firemaking: '🔥', crafting: '⚒️', smithing: '🔨',
  mining: '⛏️', herblore: '🌿', agility: '🏃', thieving: '🗝️', slayer: '💀',
  farming: '🌾', runecraft: '✨', hunter: '🦅', construction: '🏠',
};

function timeLabel(dateStr: string, status: 'active' | 'upcoming'): string {
  const ms = new Date(dateStr).getTime() - Date.now();
  const abs = Math.abs(ms);
  const mins = Math.floor(abs / 60000);
  if (mins < 60) return status === 'active' ? `${mins}m left` : `in ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return status === 'active' ? `${hrs}h left` : `in ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return status === 'active' ? `${days}d left` : `in ${days}d`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

export default function CompetitionsClient() {
  const { data: comps, isLoading } = useSWR<Competition[]>('/api/competitions', fetcher, {
    refreshInterval: 60000,
  });

  const active = comps?.filter((c) => c.status === 'active') ?? [];
  const upcoming = comps?.filter((c) => c.status === 'upcoming') ?? [];
  const featured = active[0] ?? null;
  const activeRest = active.slice(1);

  return (
    <div className="min-h-screen bg-[hsl(220_23%_7%)] text-white">
      <div className="max-w-4xl mx-auto px-4 py-10 sm:px-6">

        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
            <Link href="/groups" className="hover:text-sky-400 transition-colors">Groups</Link>
            <span>/</span>
            <span className="text-slate-300">Competitions</span>
          </div>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Competitions</h1>
              <p className="mt-1.5 text-slate-400 text-sm">Skill competitions across all groups on FeroxStats.</p>
            </div>
            {!isLoading && (active.length + upcoming.length) > 0 && (
              <div className="flex items-center gap-3 shrink-0">
                {active.length > 0 && (
                  <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.08] px-3 py-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-medium text-emerald-400">{active.length} live</span>
                  </div>
                )}
                {upcoming.length > 0 && (
                  <div className="flex items-center gap-1.5 rounded-full border border-sky-500/20 bg-sky-500/[0.08] px-3 py-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-400" />
                    <span className="text-xs font-medium text-sky-400">{upcoming.length} upcoming</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/[0.04]" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && active.length + upcoming.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] py-20 text-center">
            <span className="text-5xl">🎯</span>
            <p className="text-base font-semibold text-slate-300">No active competitions</p>
            <p className="text-sm text-slate-500">Group admins can create competitions from a group page.</p>
            <Link href="/groups" className="mt-2 text-sm text-sky-400 hover:underline">Browse Groups →</Link>
          </div>
        )}

        {/* Featured active competition */}
        {featured && <FeaturedCard comp={featured} />}

        {/* Rest of active */}
        {activeRest.length > 0 && (
          <section className="mb-8">
            {featured && (
              <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-500/50" />
                More Active
              </h2>
            )}
            {!featured && (
              <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-500/50" />
                Active · {active.length}
              </h2>
            )}
            <div className="space-y-3">
              {activeRest.map((comp) => (
                <CompetitionRow key={comp.id} comp={comp} />
              ))}
            </div>
          </section>
        )}

        {/* Upcoming competitions */}
        {upcoming.length > 0 && (
          <section>
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
              <span className="inline-block w-2 h-2 rounded-full bg-sky-400" />
              Upcoming · {upcoming.length}
            </h2>
            <div className="space-y-3">
              {upcoming.map((comp) => (
                <CompetitionRow key={comp.id} comp={comp} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function FeaturedCard({ comp }: { comp: Competition }) {
  const router = useRouter();
  const emoji = METRIC_EMOJI[comp.metric.toLowerCase()] ?? '⚔️';
  return (
    <div
      onClick={() => router.push(`/competitions/${comp.id}`)}
      className="group cursor-pointer mb-8 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.06] via-white/[0.02] to-sky-500/[0.04] p-6 transition-all hover:border-emerald-500/30 hover:from-emerald-500/[0.09]"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/[0.1] bg-white/[0.06] text-3xl">
          {emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Now
            </span>
          </div>
          <h3 className="text-xl font-bold text-white group-hover:text-slate-100 transition-colors">{comp.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-slate-400">
            <Link href={`/groups/${comp.group_slug}`} onClick={(e) => e.stopPropagation()} className="hover:text-sky-400 transition-colors">{comp.group_name}</Link>
            <span className="text-slate-600">·</span>
            <span className="capitalize">{comp.metric}</span>
            <span className="text-slate-600">·</span>
            <span>{comp.participant_count} participants</span>
            <span className="text-slate-600">·</span>
            <span className="text-emerald-500 font-medium">{timeLabel(comp.ends_at, 'active')}</span>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-[11px] text-slate-500 mb-1.5">
              <span>{formatDate(comp.starts_at)}</span>
              <span className="tabular-nums text-slate-400">{comp.progress_pct}%</span>
              <span>{formatDate(comp.ends_at)}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-500 transition-all duration-700"
                style={{ width: `${comp.progress_pct}%` }}
              />
            </div>
          </div>
        </div>
        <svg className="w-5 h-5 shrink-0 mt-1 text-slate-600 group-hover:text-emerald-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}

function CompetitionRow({ comp }: { comp: Competition }) {
  const isActive = comp.status === 'active';
  const emoji = METRIC_EMOJI[comp.metric.toLowerCase()] ?? '⚔️';
  const router = useRouter();

  return (
    <div
      onClick={() => router.push(`/competitions/${comp.id}`)}
      className="group flex cursor-pointer items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 transition-all hover:border-white/[0.12] hover:bg-white/[0.05]"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.04] text-xl">
        {emoji}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-0.5">
          <span className="text-sm font-semibold text-slate-100 group-hover:text-white transition-colors">{comp.name}</span>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
            isActive ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' : 'bg-sky-500/15 text-sky-400 border-sky-500/25'
          }`}>
            {isActive ? '● Live' : '◎ Soon'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-slate-500">
          <Link href={`/groups/${comp.group_slug}`} onClick={(e) => e.stopPropagation()} className="font-medium text-slate-400 hover:text-sky-400 transition-colors">
            {comp.group_name}
          </Link>
          <span className="capitalize">{comp.metric}</span>
          <span>{comp.participant_count} participants</span>
          <span className={isActive ? 'text-emerald-500 font-medium' : 'text-sky-500 font-medium'}>
            {isActive ? timeLabel(comp.ends_at, 'active') : timeLabel(comp.starts_at, 'upcoming')}
          </span>
        </div>
        {isActive && (
          <div className="mt-2 h-1 w-full max-w-[180px] overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-all duration-700" style={{ width: `${comp.progress_pct}%` }} />
          </div>
        )}
        {!isActive && (
          <p className="mt-1 text-[11px] text-slate-600">Starts {formatDate(comp.starts_at)}</p>
        )}
      </div>
      <svg className="w-4 h-4 shrink-0 text-slate-600 group-hover:text-slate-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </div>
  );
}
