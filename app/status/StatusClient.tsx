'use client';

import useSWR from 'swr';

type ServiceStatus = 'operational' | 'degraded' | 'outage';

interface Service {
  name: string;
  status: ServiceStatus;
  latency: number | null;
  description: string;
}

interface StatusResponse {
  status: ServiceStatus;
  checkedAt: string;
  services: Service[];
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const STATUS_CONFIG: Record<ServiceStatus, { label: string; dot: string; bar: string; badge: string }> = {
  operational: {
    label: 'Operational',
    dot: 'bg-emerald-400',
    bar: 'bg-emerald-500',
    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  },
  degraded: {
    label: 'Degraded',
    dot: 'bg-amber-400',
    bar: 'bg-amber-500',
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  },
  outage: {
    label: 'Outage',
    dot: 'bg-red-400',
    bar: 'bg-red-500',
    badge: 'bg-red-500/15 text-red-400 border-red-500/25',
  },
};

const SERVICE_ICONS: Record<string, string> = {
  'Website':        '🌐',
  'Database':       '🗄️',
  'Player Updates': '🔄',
  'GE Tracker':     '📈',
  'Ferox.ps':       '⚔️',
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 10) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  return `${Math.floor(secs / 60)}m ago`;
}

export default function StatusClient() {
  const { data, isLoading, mutate } = useSWR<StatusResponse>('/api/status', fetcher, {
    refreshInterval: 30000,
  });

  const overall = data?.status ?? 'operational';
  const cfg = STATUS_CONFIG[overall];

  const bannerBg = overall === 'operational'
    ? 'from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/20'
    : overall === 'degraded'
    ? 'from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/20'
    : 'from-red-500/10 via-red-500/5 to-transparent border-red-500/20';

  const bannerTitle = overall === 'operational'
    ? 'All systems operational'
    : overall === 'degraded'
    ? 'Some systems are degraded'
    : 'Service disruption detected';

  const bannerSub = overall === 'operational'
    ? 'Everything is running smoothly.'
    : overall === 'degraded'
    ? 'We\'re aware of performance issues and are investigating.'
    : 'We\'re experiencing a disruption. Our team is on it.';

  return (
    <div className="min-h-screen bg-[hsl(220_23%_7%)] text-white">
      <div className="max-w-3xl mx-auto px-4 py-12 sm:px-6">

        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-white">System Status</h1>
          <p className="mt-1.5 text-sm text-slate-400">Real-time health of FeroxStats services.</p>
        </div>

        {/* Overall banner */}
        <div className={`mb-8 flex items-center gap-5 rounded-2xl border bg-gradient-to-r ${bannerBg} px-6 py-5`}>
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${cfg.dot} bg-opacity-20`}>
            {overall === 'operational' && (
              <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {overall === 'degraded' && (
              <svg className="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            )}
            {overall === 'outage' && (
              <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
          <div>
            <p className="text-base font-bold text-white">{bannerTitle}</p>
            <p className="text-sm text-slate-400 mt-0.5">{bannerSub}</p>
          </div>
          <div className="ml-auto text-right shrink-0">
            {data && (
              <p className="text-xs text-slate-500">Checked {timeAgo(data.checkedAt)}</p>
            )}
            <button
              onClick={() => mutate()}
              className="mt-1.5 text-xs text-slate-500 hover:text-white transition-colors flex items-center gap-1 ml-auto"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Service list */}
        <div className="space-y-3">
          {isLoading
            ? [...Array(4)].map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/[0.04]" />
              ))
            : data?.services.map((svc) => {
                const s = STATUS_CONFIG[svc.status];
                return (
                  <div
                    key={svc.name}
                    className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-5 py-4"
                  >
                    {/* Icon */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-xl">
                      {SERVICE_ICONS[svc.name] ?? '🔧'}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold text-white">{svc.name}</p>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${s.badge}`}>
                          {s.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">{svc.description}</p>
                    </div>

                    {/* Latency / indicator */}
                    <div className="shrink-0 text-right">
                      {svc.latency !== null ? (
                        <div>
                          <p className="text-sm font-bold tabular-nums text-slate-200">{svc.latency}ms</p>
                          {/* Mini latency bar */}
                          <div className="mt-1 h-1 w-20 overflow-hidden rounded-full bg-white/[0.06]">
                            <div
                              className={`h-full rounded-full transition-all ${s.bar}`}
                              style={{ width: `${Math.min(100, (svc.latency / 3000) * 100)}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${s.dot} ${svc.status === 'operational' ? 'animate-pulse' : ''}`} />
                      )}
                    </div>
                  </div>
                );
              })}
        </div>

        {/* Footer note */}
        <p className="mt-8 text-center text-xs text-slate-600">
          Status checks run every 30 seconds. This page auto-refreshes.
        </p>
      </div>
    </div>
  );
}
