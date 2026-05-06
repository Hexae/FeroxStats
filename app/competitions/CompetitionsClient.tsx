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
      className="group cursor-pointer mb-10 overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.08] via-white/[0.02] to-sky-500/[0.04] transition-all hover:border-emerald-500/50 hover:from-emerald-500/[0.12] hover:shadow-lg hover:shadow-emerald-500/5"
    >
      {/* Background accent */}
      <div className="absolute -right-32 -top-32 h-64 w-64 rounded-full bg-gradient-to-br from-emerald-500/10 to-transparent blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="relative p-8 space-y-4">
        {/* Status badge and header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 text-3xl shadow-lg shadow-emerald-500/10">
              {emoji}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 rounded-full px-2.5 py-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Now
                </span>
              </div>
              <h3 className="text-2xl font-bold text-white group-hover:text-slate-50 transition-colors line-clamp-2">{comp.name}</h3>
              <Link href={`/groups/${comp.group_slug}`} onClick={(e) => e.stopPropagation()} className="text-sm text-slate-400 hover:text-emerald-400 transition-colors font-medium mt-1">
                {comp.group_name}
              </Link>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs uppercase tracking-widest text-slate-500 mb-1">Time Left</p>
            <p className="text-lg font-bold text-emerald-400 tabular-nums">{timeLabel(comp.ends_at, 'active')}</p>
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-white/[0.08]">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500 mb-1.5">Metric</p>
            <p className="text-sm font-semibold text-slate-100 capitalize">{comp.metric}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500 mb-1.5">Participants</p>
            <p className="text-sm font-semibold text-slate-100">{comp.participant_count}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500 mb-1.5">Progress</p>
            <p className="text-sm font-semibold text-emerald-400">{comp.progress_pct}% complete</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="pt-2 space-y-2">
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>{formatDate(comp.starts_at)}</span>
            <span>{formatDate(comp.ends_at)}</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06] border border-white/[0.04]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-500 shadow-lg shadow-emerald-500/30 transition-all duration-700"
              style={{ width: `${comp.progress_pct}%` }}
            />
          </div>
        </div>

        {/* Action hint */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-500">Click to view full standings</p>
          <svg className="w-4 h-4 text-emerald-400/0 group-hover:text-emerald-400 transition-all transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
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
      className="group flex cursor-pointer items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-6 py-5 transition-all hover:border-white/[0.15] hover:bg-white/[0.08] hover:shadow-lg hover:shadow-black/20"
    >
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-lg font-semibold transition-all ${
        isActive 
          ? 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 to-emerald-500/5' 
          : 'border-sky-500/30 bg-gradient-to-br from-sky-500/15 to-sky-500/5'
      }`}>
        {emoji}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-1">
          <span className="text-sm font-bold text-slate-100 group-hover:text-white transition-colors">{comp.name}</span>
          <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1 ${
            isActive ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-sky-500/20 text-sky-300 border-sky-500/30'
          }`}>
            <span className={`inline-block w-1 h-1 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-sky-400'}`} />
            {isActive ? 'Live' : 'Upcoming'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-slate-500">
          <Link href={`/groups/${comp.group_slug}`} onClick={(e) => e.stopPropagation()} className="font-medium text-slate-400 hover:text-sky-400 transition-colors">
            {comp.group_name}
          </Link>
          <span className="text-slate-700">·</span>
          <span className="capitalize">{comp.metric}</span>
          <span className="text-slate-700">·</span>
          <span className="font-medium">{comp.participant_count} {comp.participant_count === 1 ? 'participant' : 'participants'}</span>
          <span className="text-slate-700">·</span>
          <span className={`font-semibold ${isActive ? 'text-emerald-400' : 'text-sky-400'}`}>
            {isActive ? timeLabel(comp.ends_at, 'active') : timeLabel(comp.starts_at, 'upcoming')}
          </span>
        </div>
        {isActive && (
          <div className="mt-3 space-y-1.5">
            <div className="h-1.5 w-full max-w-[200px] overflow-hidden rounded-full bg-white/[0.06] border border-white/[0.04]">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-500 shadow-lg shadow-emerald-500/30 transition-all duration-700" style={{ width: `${comp.progress_pct}%` }} />
            </div>
            <p className="text-xs text-slate-600">{comp.progress_pct}% complete</p>
          </div>
        )}
        {!isActive && (
          <p className="mt-1.5 text-xs text-slate-600">Starts {formatDate(comp.starts_at)}</p>
        )}
      </div>
      <svg className="w-5 h-5 shrink-0 text-slate-600 group-hover:text-slate-400 transition-all transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </div>
  );
}
