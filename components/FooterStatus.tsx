'use client';

import Link from 'next/link';
import useSWR from 'swr';

type OverallStatus = 'operational' | 'degraded' | 'outage';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const DOT: Record<OverallStatus, string> = {
  operational: 'bg-green-500',
  degraded:    'bg-amber-400',
  outage:      'bg-red-500',
};

const LABEL: Record<OverallStatus, string> = {
  operational: 'All systems online',
  degraded:    'Some systems degraded',
  outage:      'Service disruption',
};

const TEXT: Record<OverallStatus, string> = {
  operational: 'hover:text-green-400',
  degraded:    'text-amber-400 hover:text-amber-300',
  outage:      'text-red-400 hover:text-red-300',
};

export default function FooterStatus() {
  const { data } = useSWR<{ status: OverallStatus }>('/api/status', fetcher, {
    refreshInterval: 60000,
    revalidateOnFocus: false,
  });

  const status: OverallStatus = data?.status ?? 'operational';

  return (
    <Link
      href="/status"
      className={`flex items-center gap-1.5 text-xs transition-colors ${TEXT[status]}`}
    >
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${DOT[status]} ${status === 'operational' ? 'animate-pulse' : ''}`} />
      {LABEL[status]}
    </Link>
  );
}
