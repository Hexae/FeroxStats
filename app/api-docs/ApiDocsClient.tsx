'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';
type AuthLevel = 'public' | 'user' | 'admin' | 'internal';

type Param = {
  name: string;
  type: string;
  required: boolean;
  description: string;
};

type Endpoint = {
  id: string;
  method: HttpMethod;
  path: string;
  summary: string;
  auth: AuthLevel;
  pathParams?: Param[];
  queryParams?: Param[];
  bodyParams?: Param[];
  requestExample?: string;
  responseExample?: string;
  statusCodes: Array<{ code: number; description: string }>;
};

type EndpointGroup = {
  id: string;
  title: string;
  description: string;
  endpoints: Endpoint[];
};

type SortOption = 'default' | 'method' | 'auth';

const endpointGroups: EndpointGroup[] = [
  {
    id: 'players',
    title: 'Players',
    description: 'Player profiles, search, gains, achievements, and snapshots.',
    endpoints: [
      {
        id: 'get-player',
        method: 'GET',
        path: '/api/player/{username}',
        summary: 'Fetch live hiscores plus local metadata for a player.',
        auth: 'public',
        pathParams: [
          { name: 'username', type: 'string', required: true, description: 'Ferox player username.' },
        ],
        requestExample: 'curl -X GET "https://feroxstats.com/api/player/synx"',
        responseExample: `{
  "name": "Synx",
  "skills": [{ "id": 0, "rank": 21, "level": 2277, "xp": "1240000000" }],
  "game_mode": "regular",
  "is_claimed": true,
  "country": "US",
  "screenshots": []
}`,
        statusCodes: [
          { code: 200, description: 'Player returned.' },
          { code: 404, description: 'Player not found on Ferox API.' },
          { code: 502, description: 'Upstream fetch failure.' },
        ],
      },
      {
        id: 'search-players',
        method: 'GET',
        path: '/api/search',
        summary: 'Search players by partial username.',
        auth: 'public',
        queryParams: [{ name: 'q', type: 'string', required: true, description: 'Search term.' }],
        requestExample: 'curl -X GET "https://feroxstats.com/api/search?q=syn"',
        responseExample: `[
  { "username": "synx", "display_name": "Synx" },
  { "username": "synical", "display_name": "Synical" }
]`,
        statusCodes: [{ code: 200, description: 'Search results returned.' }],
      },
      {
        id: 'player-gains',
        method: 'GET',
        path: '/api/player/{username}/gains',
        summary: 'Get XP gains and daily heatmap data for a period.',
        auth: 'public',
        pathParams: [{ name: 'username', type: 'string', required: true, description: 'Ferox player username.' }],
        queryParams: [
          {
            name: 'period',
            type: 'enum(day|week|month|year|all)',
            required: false,
            description: 'Time window. Defaults to week.',
          },
        ],
        requestExample: 'curl -X GET "https://feroxstats.com/api/player/synx/gains?period=month"',
        responseExample: `{
  "period": "month",
  "totalXpGained": 13044321,
  "heatmap": [{ "date": "2026-04-12", "xp": 344001 }]
}`,
        statusCodes: [
          { code: 200, description: 'Gains payload returned.' },
          { code: 200, description: 'May return gains: null if insufficient snapshots.' },
        ],
      },
      {
        id: 'player-achievements',
        method: 'GET',
        path: '/api/player/{username}/achievements',
        summary: 'Return major milestones inferred from historical snapshots.',
        auth: 'public',
        pathParams: [{ name: 'username', type: 'string', required: true, description: 'Ferox player username.' }],
        responseExample: `{
  "achievements": [
    {
      "key": "skill99_10",
      "label": "99 Fishing",
      "completedAt": "2026-03-10T12:23:00.000Z",
      "isLegacy": false
    }
  ]
}`,
        statusCodes: [{ code: 200, description: 'Achievements returned.' }],
      },
      {
        id: 'player-screenshots-upload',
        method: 'POST',
        path: '/api/player/{username}/screenshot',
        summary: 'Upload a screenshot for your claimed player profile.',
        auth: 'user',
        pathParams: [{ name: 'username', type: 'string', required: true, description: 'Owner player username.' }],
        bodyParams: [
          {
            name: 'screenshot',
            type: 'multipart file (jpg/png/webp/gif)',
            required: true,
            description: 'Image up to 5 MB.',
          },
        ],
        statusCodes: [
          { code: 200, description: 'Screenshot uploaded and persisted.' },
          { code: 400, description: 'Invalid file type, too large, or max screenshots reached.' },
          { code: 403, description: 'You are not the owner of this player profile.' },
        ],
      },
    ],
  },
  {
    id: 'rankings',
    title: 'Rankings',
    description: 'Global rankings, hiscores, and comparison endpoints.',
    endpoints: [
      {
        id: 'global-hiscores',
        method: 'GET',
        path: '/api/hiscores',
        summary: 'Get top hiscore rows for overall or a specific skill.',
        auth: 'public',
        queryParams: [
          { name: 'skill', type: 'string', required: false, description: 'Skill key. Defaults to overall.' },
          { name: 'limit', type: 'number', required: false, description: 'Max 100. Defaults to 25.' },
        ],
        statusCodes: [{ code: 200, description: 'Hiscore rows returned.' }],
      },
      {
        id: 'leaderboard',
        method: 'GET',
        path: '/api/leaderboard',
        summary: 'Get top 50 sorted by overall rank, total level, or total XP.',
        auth: 'public',
        queryParams: [
          {
            name: 'sort',
            type: 'enum(overall_rank|total_level|total_xp)',
            required: false,
            description: 'Sort field. Defaults to overall_rank.',
          },
        ],
        statusCodes: [
          { code: 200, description: 'Leaderboard rows returned.' },
          { code: 500, description: 'Database query failure.' },
        ],
      },
      {
        id: 'compare',
        method: 'GET',
        path: '/api/compare',
        summary: 'Compare multiple players in a single call.',
        auth: 'public',
        queryParams: [
          {
            name: 'players',
            type: 'string (comma-separated)',
            required: true,
            description: '2 to 5 usernames.',
          },
        ],
        requestExample: 'curl -X GET "https://feroxstats.com/api/compare?players=synx,mik,kat"',
        responseExample: `{
  "players": [
    { "username": "synx", "data": { "name": "Synx" } },
    { "username": "mik", "data": { "name": "Mik" } }
  ]
}`,
        statusCodes: [
          { code: 200, description: 'Comparison payload returned.' },
          { code: 400, description: 'Missing players or less than 2 users.' },
        ],
      },
      {
        id: 'top-gains',
        method: 'GET',
        path: '/api/top-gains',
        summary: 'Get top XP gainers for day, week, or month.',
        auth: 'public',
        queryParams: [
          { name: 'period', type: 'enum(day|week|month)', required: false, description: 'Defaults to week.' },
          { name: 'limit', type: 'number', required: false, description: 'Max 50. Defaults to 20.' },
        ],
        statusCodes: [{ code: 200, description: 'Top gains payload returned.' }],
      },
    ],
  },
  {
    id: 'groups',
    title: 'Groups',
    description: 'Group CRUD, membership workflows, requests, and competitions.',
    endpoints: [
      {
        id: 'list-groups',
        method: 'GET',
        path: '/api/groups',
        summary: 'List groups with search and pagination.',
        auth: 'public',
        queryParams: [
          { name: 'q', type: 'string', required: false, description: 'Name search filter.' },
          { name: 'limit', type: 'number', required: false, description: 'Max 100. Defaults to 20.' },
          { name: 'offset', type: 'number', required: false, description: 'Pagination offset.' },
        ],
        statusCodes: [{ code: 200, description: 'Group list returned.' }],
      },
      {
        id: 'create-group',
        method: 'POST',
        path: '/api/groups',
        summary: 'Create a group for the authenticated user.',
        auth: 'user',
        bodyParams: [
          { name: 'name', type: 'string', required: true, description: '2 to 60 chars.' },
          { name: 'description', type: 'string', required: false, description: 'Optional group description.' },
          { name: 'is_private', type: 'boolean', required: false, description: 'If true, requests required to join.' },
        ],
        statusCodes: [
          { code: 200, description: 'Group created.' },
          { code: 400, description: 'Validation failed or no claimed player.' },
          { code: 401, description: 'Not authenticated.' },
        ],
      },
      {
        id: 'group-competitions',
        method: 'GET',
        path: '/api/groups/{slug}/competitions',
        summary: 'List competitions by status for a specific group.',
        auth: 'public',
        pathParams: [{ name: 'slug', type: 'string', required: true, description: 'Group slug.' }],
        queryParams: [
          {
            name: 'status',
            type: 'enum(active|upcoming|ended)',
            required: false,
            description: 'Optional status filter.',
          },
        ],
        statusCodes: [{ code: 200, description: 'Competition list returned.' }],
      },
      {
        id: 'global-competitions',
        method: 'GET',
        path: '/api/competitions',
        summary: 'List all active and upcoming competitions across groups.',
        auth: 'public',
        statusCodes: [{ code: 200, description: 'Competition list returned.' }],
      },
    ],
  },
  {
    id: 'grand-exchange',
    title: 'Grand Exchange',
    description: 'Recent transactions, offers, aggregates, and item history.',
    endpoints: [
      {
        id: 'ge-feed',
        method: 'GET',
        path: '/api/ge',
        summary: 'Get offers/transactions and aggregate tabs.',
        auth: 'public',
        queryParams: [
          {
            name: 'tab',
            type: 'enum(transactions|offers|most-traded|overview-summary)',
            required: false,
            description: 'Select data set. Defaults to transactions.',
          },
          { name: 'range', type: 'enum(1D|3D|1W|1M)', required: false, description: 'Used by most-traded tab.' },
        ],
        statusCodes: [
          { code: 200, description: 'GE payload returned.' },
          { code: 502, description: 'Upstream Ferox API unavailable.' },
        ],
      },
      {
        id: 'ge-item-history',
        method: 'GET',
        path: '/api/ge/item',
        summary: 'Get trade rows for one item name.',
        auth: 'public',
        queryParams: [
          { name: 'name', type: 'string', required: true, description: 'Exact item name.' },
          { name: 'limit', type: 'number', required: false, description: 'Max 10000. Defaults to 150.' },
        ],
        statusCodes: [{ code: 200, description: 'Item history returned.' }],
      },
      {
        id: 'ge-price-history',
        method: 'GET',
        path: '/api/ge/item/price-history',
        summary: 'Get sampled price points for one item.',
        auth: 'public',
        queryParams: [
          { name: 'name', type: 'string', required: true, description: 'Exact item name.' },
          { name: 'limit', type: 'number', required: false, description: 'Max 10000. Defaults to 5000.' },
        ],
        statusCodes: [{ code: 200, description: 'Price series returned.' }],
      },
    ],
  },
  {
    id: 'account-admin',
    title: 'Account, Auth, and Admin',
    description: 'Claim flow, preference updates, admin controls, and internal jobs.',
    endpoints: [
      {
        id: 'claim-player',
        method: 'POST',
        path: '/api/claim',
        summary: 'Claim a player profile to your account.',
        auth: 'user',
        bodyParams: [
          { name: 'username', type: 'string', required: true, description: 'Target player username.' },
          { name: 'game_mode', type: 'string', required: false, description: 'Optional mode override.' },
        ],
        statusCodes: [
          { code: 200, description: 'Claim successful.' },
          { code: 409, description: 'Player already claimed or you already claimed another.' },
        ],
      },
      {
        id: 'unclaim-player',
        method: 'POST',
        path: '/api/unclaim',
        summary: 'Unclaim the player linked to your account.',
        auth: 'user',
        statusCodes: [{ code: 200, description: 'Unclaim successful.' }],
      },
      {
        id: 'update-gamemode',
        method: 'POST',
        path: '/api/gamemode',
        summary: 'Set game mode for your claimed player.',
        auth: 'user',
        bodyParams: [{ name: 'game_mode', type: 'string', required: true, description: 'One of supported modes.' }],
        statusCodes: [{ code: 200, description: 'Mode updated.' }],
      },
      {
        id: 'admin-toggle',
        method: 'POST',
        path: '/api/admin/toggle-admin',
        summary: 'Toggle admin role for a user profile.',
        auth: 'admin',
        statusCodes: [
          { code: 200, description: 'Admin status updated.' },
          { code: 403, description: 'Admin privileges required.' },
        ],
      },
      {
        id: 'cron-update-players',
        method: 'GET',
        path: '/api/cron/update-players',
        summary: 'Internal cron endpoint for refreshing player snapshots.',
        auth: 'internal',
        statusCodes: [
          { code: 200, description: 'Cron run completed.' },
          { code: 401, description: 'Invalid bearer secret.' },
        ],
      },
    ],
  },
];

const methodClass: Record<HttpMethod, string> = {
  GET: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
  POST: 'border-sky-500/40 bg-sky-500/15 text-sky-300',
  PATCH: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
  DELETE: 'border-rose-500/40 bg-rose-500/15 text-rose-300',
};

const authClass: Record<AuthLevel, string> = {
  public: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300',
  user: 'border-sky-400/30 bg-sky-500/10 text-sky-300',
  admin: 'border-amber-400/30 bg-amber-500/10 text-amber-300',
  internal: 'border-rose-400/30 bg-rose-500/10 text-rose-300',
};

function renderParamTable(title: string, params?: Param[]) {
  if (!params || params.length === 0) return null;

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-white/10">
      <p className="border-b border-white/10 bg-black/30 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
        {title}
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs text-slate-300">
          <thead className="bg-black/30 text-slate-400">
            <tr>
              <th className="px-3 py-2 font-semibold">Name</th>
              <th className="px-3 py-2 font-semibold">Type</th>
              <th className="px-3 py-2 font-semibold">Required</th>
              <th className="px-3 py-2 font-semibold">Description</th>
            </tr>
          </thead>
          <tbody>
            {params.map((param) => (
              <tr key={param.name} className="border-t border-white/10">
                <td className="px-3 py-2 font-mono text-slate-100">{param.name}</td>
                <td className="px-3 py-2">{param.type}</td>
                <td className="px-3 py-2">{param.required ? 'Yes' : 'No'}</td>
                <td className="px-3 py-2">{param.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function defaultPathValue(param: string): string {
  if (param === 'username') return 'synx';
  if (param === 'slug') return 'example-group';
  if (param === 'requestId') return 'req_123';
  if (param === 'compId') return 'comp_123';
  return 'value';
}

function buildDefaultPath(path: string): string {
  return path.replace(/\{([^}]+)\}/g, (_, p1: string) => defaultPathValue(p1));
}

function getEndpointTags(group: EndpointGroup, endpoint: Endpoint): string[] {
  const tags = [group.title.toLowerCase()];

  if (endpoint.pathParams?.length) tags.push('path-param');
  if (endpoint.queryParams?.length) tags.push('query');
  if (endpoint.bodyParams?.length) tags.push('body');
  tags.push(endpoint.method === 'GET' ? 'read' : 'write');
  if (endpoint.method === 'GET' && endpoint.auth === 'public') tags.push('try-request');

  return tags;
}

function compareEndpoints(sortOption: SortOption, a: Endpoint, b: Endpoint): number {
  if (sortOption === 'method') {
    return a.method.localeCompare(b.method) || a.path.localeCompare(b.path);
  }

  if (sortOption === 'auth') {
    return a.auth.localeCompare(b.auth) || a.path.localeCompare(b.path);
  }

  return 0;
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

type TryRequestPanelProps = {
  endpoint: Endpoint;
};

function TryRequestPanel({ endpoint }: TryRequestPanelProps) {
  const [baseUrl, setBaseUrl] = useState('');
  const [pathValues, setPathValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const param of endpoint.pathParams ?? []) initial[param.name] = defaultPathValue(param.name);
    return initial;
  });
  const [queryValues, setQueryValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const param of endpoint.queryParams ?? []) initial[param.name] = '';
    return initial;
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');

  const origin = useMemo(() => {
    if (typeof window === 'undefined') return 'https://feroxstats.com';
    return window.location.origin;
  }, []);

  const resolvedBaseUrl = baseUrl.trim() || origin;

  const resolvedPath = useMemo(() => {
    return endpoint.path.replace(/\{([^}]+)\}/g, (_, p1: string) => encodeURIComponent(pathValues[p1] ?? defaultPathValue(p1)));
  }, [endpoint.path, pathValues]);

  const fullUrl = useMemo(() => {
    const url = new URL(`${resolvedBaseUrl}${resolvedPath}`);
    for (const [key, value] of Object.entries(queryValues)) {
      if (value.trim()) url.searchParams.set(key, value.trim());
    }
    return url.toString();
  }, [queryValues, resolvedBaseUrl, resolvedPath]);

  async function runRequest() {
    setLoading(true);
    setResult('');

    try {
      const res = await fetch(fullUrl, { method: 'GET' });
      let payload: unknown;
      try {
        payload = await res.json();
      } catch {
        payload = await res.text();
      }

      setResult(
        JSON.stringify(
          {
            status: res.status,
            ok: res.ok,
            url: fullUrl,
            data: payload,
          },
          null,
          2,
        ),
      );
    } catch (error) {
      setResult(
        JSON.stringify(
          {
            status: 0,
            ok: false,
            url: fullUrl,
            error: error instanceof Error ? error.message : 'Request failed',
          },
          null,
          2,
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-white/10 bg-black/35 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Try Request</p>

      <div className="mt-2 space-y-2">
        <label className="block text-xs text-slate-300">
          Base URL
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={origin}
            className="mt-1 w-full rounded-md border border-white/15 bg-black/50 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-400/60"
          />
        </label>

        {(endpoint.pathParams ?? []).map((param) => (
          <label key={param.name} className="block text-xs text-slate-300">
            Path: {param.name}
            <input
              type="text"
              value={pathValues[param.name] ?? ''}
              onChange={(e) =>
                setPathValues((prev) => ({
                  ...prev,
                  [param.name]: e.target.value,
                }))
              }
              className="mt-1 w-full rounded-md border border-white/15 bg-black/50 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-400/60"
            />
          </label>
        ))}

        {(endpoint.queryParams ?? []).map((param) => (
          <label key={param.name} className="block text-xs text-slate-300">
            Query: {param.name}
            <input
              type="text"
              value={queryValues[param.name] ?? ''}
              onChange={(e) =>
                setQueryValues((prev) => ({
                  ...prev,
                  [param.name]: e.target.value,
                }))
              }
              className="mt-1 w-full rounded-md border border-white/15 bg-black/50 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-400/60"
            />
          </label>
        ))}

        <div className="rounded-md border border-white/10 bg-black/50 px-2 py-1.5 text-xs text-slate-300">{fullUrl}</div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={runRequest}
            disabled={loading}
            className="rounded-md border border-sky-400/40 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-300 transition-colors hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Sending...' : 'Send GET'}
          </button>
          <button
            type="button"
            onClick={() => copyText(fullUrl)}
            className="rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/10"
          >
            Copy URL
          </button>
        </div>
      </div>

      <pre className="mt-3 max-h-72 overflow-auto rounded-md border border-white/10 bg-black/60 p-2 text-xs leading-relaxed text-slate-200">
{result || '{\n  "status": null,\n  "data": null\n}'}
      </pre>
    </div>
  );
}

export default function ApiDocsClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const endpointCount = endpointGroups.reduce((sum, group) => sum + group.endpoints.length, 0);
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [authFilter, setAuthFilter] = useState<'all' | AuthLevel>(
    (searchParams.get('auth') as 'all' | AuthLevel | null) ?? 'all',
  );
  const [methodFilter, setMethodFilter] = useState<'all' | HttpMethod>(
    (searchParams.get('method') as 'all' | HttpMethod | null) ?? 'all',
  );
  const [sortBy, setSortBy] = useState<SortOption>((searchParams.get('sort') as SortOption | null) ?? 'default');
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (authFilter !== 'all') params.set('auth', authFilter);
    if (methodFilter !== 'all') params.set('method', methodFilter);
    if (sortBy !== 'default') params.set('sort', sortBy);

    const search = params.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }, [authFilter, methodFilter, pathname, query, router, sortBy]);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();

    return endpointGroups
      .map((group) => {
        const endpoints = group.endpoints
          .filter((endpoint) => {
            const tags = getEndpointTags(group, endpoint);
            const matchesQuery =
              q.length === 0 ||
              endpoint.path.toLowerCase().includes(q) ||
              endpoint.summary.toLowerCase().includes(q) ||
              endpoint.id.toLowerCase().includes(q) ||
              tags.some((tag) => tag.includes(q));

            const matchesAuth = authFilter === 'all' || endpoint.auth === authFilter;
            const matchesMethod = methodFilter === 'all' || endpoint.method === methodFilter;

            return matchesQuery && matchesAuth && matchesMethod;
          })
          .sort((a, b) => compareEndpoints(sortBy, a, b));

        return { ...group, endpoints };
      })
      .filter((group) => group.endpoints.length > 0);
  }, [authFilter, methodFilter, query, sortBy]);

  const filteredCount = filteredGroups.reduce((sum, group) => sum + group.endpoints.length, 0);
  const filteredEndpointIds = filteredGroups.flatMap((group) => group.endpoints.map((endpoint) => endpoint.id));

  function toggleEndpoint(id: string) {
    setOpenIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function expandAll() {
    setOpenIds((prev) => {
      const next = { ...prev };
      for (const id of filteredEndpointIds) next[id] = true;
      return next;
    });
  }

  function collapseAll() {
    setOpenIds((prev) => {
      const next = { ...prev };
      for (const id of filteredEndpointIds) next[id] = false;
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_0%,hsl(206_95%_23%)_0%,hsl(220_26%_9%)_50%,hsl(220_26%_6%)_100%)]">
      <section className="mx-auto w-full max-w-7xl px-4 pb-8 pt-12 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[hsl(220_23%_11%)]/80 p-6 shadow-2xl shadow-black/40 sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 left-20 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />

          <p className="mb-3 inline-flex items-center rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-200">
            FeroxStats REST API
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">API Reference</h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-base">
            Searchable endpoint reference with interactive requests for public GET endpoints.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-widest text-slate-400">Base URL</p>
              <p className="mt-1 font-mono text-sm text-slate-100">https://feroxstats.com</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-widest text-slate-400">Total Endpoints</p>
              <p className="mt-1 text-sm text-slate-100">{endpointCount}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-widest text-slate-400">Visible Endpoints</p>
              <p className="mt-1 text-sm text-slate-100">{filteredCount}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-widest text-slate-400">Response Format</p>
              <p className="mt-1 text-sm text-slate-100">JSON</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 rounded-xl border border-white/10 bg-black/30 p-4 md:grid-cols-4">
            <label className="text-xs text-slate-300">
              Search endpoints
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="path, summary, id"
                className="mt-1 w-full rounded-md border border-white/15 bg-black/50 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-400/60"
              />
            </label>

            <label className="text-xs text-slate-300">
              Filter by auth
              <select
                value={authFilter}
                onChange={(e) => setAuthFilter(e.target.value as 'all' | AuthLevel)}
                className="mt-1 w-full rounded-md border border-white/15 bg-black/50 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-400/60"
              >
                <option value="all">All</option>
                <option value="public">Public</option>
                <option value="user">User</option>
                <option value="admin">Admin</option>
                <option value="internal">Internal</option>
              </select>
            </label>

            <label className="text-xs text-slate-300">
              Filter by method
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value as 'all' | HttpMethod)}
                className="mt-1 w-full rounded-md border border-white/15 bg-black/50 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-400/60"
              >
                <option value="all">All</option>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
            </label>

            <label className="text-xs text-slate-300">
              Sort endpoints
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="mt-1 w-full rounded-md border border-white/15 bg-black/50 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-400/60"
              >
                <option value="default">Default</option>
                <option value="method">Method</option>
                <option value="auth">Auth</option>
              </select>
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={expandAll}
              className="rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/10"
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/10"
            >
              Collapse All
            </button>
            <div className="rounded-md border border-sky-400/20 bg-sky-500/10 px-3 py-1.5 text-xs text-sky-200">
              Shareable URL updates automatically as you search and filter.
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 pb-20 sm:px-6 lg:grid-cols-[270px_1fr] lg:px-8">
        <aside className="h-fit rounded-2xl border border-white/10 bg-[hsl(220_23%_11%)]/80 p-4 lg:sticky lg:top-20">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Navigation</p>
          <nav className="space-y-3">
            {filteredGroups.map((group) => (
              <div key={group.id}>
                <a href={`#${group.id}`} className="block rounded-md px-2 py-1.5 text-sm font-semibold text-slate-100 hover:bg-white/5">
                  {group.title}
                </a>
                <div className="mt-1 space-y-1 pl-2">
                  {group.endpoints.map((endpoint) => (
                    <a
                      key={endpoint.id}
                      href={`#${endpoint.id}`}
                      className="block rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-white/5 hover:text-slate-200"
                    >
                      {endpoint.method} {endpoint.path}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <div className="space-y-8">
          {filteredGroups.map((group) => (
            <section key={group.id} id={group.id} className="rounded-2xl border border-white/10 bg-[hsl(220_23%_11%)]/80 p-5 sm:p-6">
              <h2 className="text-2xl font-semibold tracking-tight text-white">{group.title}</h2>
              <p className="mt-2 text-sm text-slate-300">{group.description}</p>

              <div className="mt-5 space-y-4">
                {group.endpoints.map((endpoint) => {
                  const isOpen = !!openIds[endpoint.id];
                  const tags = getEndpointTags(group, endpoint);
                  const resolvedPath = buildDefaultPath(endpoint.path);
                  const requestSnippet =
                    endpoint.requestExample ??
                    `curl -X ${endpoint.method} "https://feroxstats.com${resolvedPath}"`;
                  const responseSnippet =
                    endpoint.responseExample ??
                    `{
  "ok": true
}`;

                  return (
                    <article key={endpoint.id} id={endpoint.id} className="rounded-xl border border-white/10 bg-black/25 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-md border px-2 py-1 text-xs font-bold tracking-wide ${methodClass[endpoint.method]}`}>
                          {endpoint.method}
                        </span>
                        <code className="rounded-md bg-black/50 px-2 py-1 font-mono text-sm text-slate-100">
                          {endpoint.path}
                        </code>
                        <span
                          className={`rounded-md border px-2 py-1 text-[11px] font-semibold uppercase tracking-wider ${authClass[endpoint.auth]}`}
                        >
                          {endpoint.auth}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyText(endpoint.path)}
                          className="rounded-md border border-white/20 bg-white/5 px-2 py-1 text-[11px] font-semibold text-slate-300 transition-colors hover:bg-white/10"
                        >
                          Copy Path
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleEndpoint(endpoint.id)}
                          className="ml-auto rounded-md border border-white/20 bg-white/5 px-2 py-1 text-[11px] font-semibold text-slate-300 transition-colors hover:bg-white/10"
                        >
                          {isOpen ? 'Collapse' : 'Expand'}
                        </button>
                      </div>

                      <p className="mt-3 text-sm text-slate-300">{endpoint.summary}</p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {tags.map((tag) => (
                          <span
                            key={`${endpoint.id}-${tag}`}
                            className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-300"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      {isOpen && (
                        <>
                          {renderParamTable('Path Parameters', endpoint.pathParams)}
                          {renderParamTable('Query Parameters', endpoint.queryParams)}
                          {renderParamTable('Body Parameters', endpoint.bodyParams)}

                          <div className="mt-4 grid gap-4 lg:grid-cols-2">
                            <div className="rounded-lg border border-white/10 bg-black/35 p-3">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Request Example</p>
                                <button
                                  type="button"
                                  onClick={() => copyText(requestSnippet)}
                                  className="rounded-md border border-white/20 bg-white/5 px-2 py-1 text-[11px] font-semibold text-slate-300 transition-colors hover:bg-white/10"
                                >
                                  Copy
                                </button>
                              </div>
                              <pre className="mt-2 overflow-x-auto text-xs leading-relaxed text-slate-200">{requestSnippet}</pre>
                            </div>

                            <div className="rounded-lg border border-white/10 bg-black/35 p-3">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Response Example</p>
                                <button
                                  type="button"
                                  onClick={() => copyText(responseSnippet)}
                                  className="rounded-md border border-white/20 bg-white/5 px-2 py-1 text-[11px] font-semibold text-slate-300 transition-colors hover:bg-white/10"
                                >
                                  Copy
                                </button>
                              </div>
                              <pre className="mt-2 overflow-x-auto text-xs leading-relaxed text-slate-200">{responseSnippet}</pre>
                            </div>
                          </div>

                          <div className="mt-4 rounded-lg border border-white/10 bg-black/35 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status Codes</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {endpoint.statusCodes.map((status) => (
                                <span
                                  key={`${endpoint.id}-${status.code}-${status.description}`}
                                  className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs text-slate-200"
                                >
                                  {status.code} - {status.description}
                                </span>
                              ))}
                            </div>
                          </div>

                          {endpoint.method === 'GET' && endpoint.auth === 'public' && <TryRequestPanel endpoint={endpoint} />}
                        </>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}

          {filteredGroups.length === 0 && (
            <section className="rounded-2xl border border-white/10 bg-[hsl(220_23%_11%)]/80 p-8 text-center">
              <p className="text-sm text-slate-300">No endpoints match your current search/filter.</p>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}
