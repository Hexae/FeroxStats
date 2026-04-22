'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

interface Group {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
  is_private: boolean;
  member_count: number;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return '1 month ago';
  if (months < 12) return `${months} months ago`;
  return `${Math.floor(months / 12)} year${Math.floor(months / 12) > 1 ? 's' : ''} ago`;
}

export default function GroupsClient() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Auth state
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const apiUrl = `/api/groups?limit=30${debouncedQuery ? `&q=${encodeURIComponent(debouncedQuery)}` : ''}`;
  const { data, error, isLoading, mutate } = useSWR<Group[]>(apiUrl, fetcher, { revalidateOnFocus: false });
  const groups = Array.isArray(data) ? data : [];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: createName.trim(), description: createDesc.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to create group');
      setShowCreate(false);
      setCreateName('');
      setCreateDesc('');
      mutate();
      router.push(`/groups/${json.slug}`);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 animate-fade-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div>
          <h1 className="text-4xl font-extrabold text-white mb-2">Groups</h1>
          <p className="text-slate-400">Create clans, track aggregate gains, and compete on group leaderboards.</p>
        </div>
        {user ? (
          <button
            onClick={() => setShowCreate(v => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors shadow shadow-blue-900/40"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
            </svg>
            Create Group
          </button>
        ) : (
          <Link
            href="/auth/login"
            className="px-4 py-2 bg-[#1e1c2a] border border-white/10 hover:border-white/20 text-slate-300 text-sm font-medium rounded-lg transition-colors"
          >
            Sign in to create a group
          </Link>
        )}
      </div>

      {/* Create Group Form */}
      {showCreate && (
        <div className="mb-6 bg-[#1e1c2a] border border-white/[0.07] rounded-2xl p-5 shadow-xl">
          <h2 className="text-lg font-bold text-white mb-4">New Group</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                Group Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                placeholder="e.g. Ferox Elite"
                maxLength={60}
                required
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                Description
              </label>
              <textarea
                value={createDesc}
                onChange={e => setCreateDesc(e.target.value)}
                placeholder="Describe your group..."
                maxLength={300}
                rows={2}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              />
            </div>
            {createError && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {createError}
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={creating || !createName.trim()}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {creating ? 'Creating...' : 'Create Group'}
              </button>
              <button
                type="button"
                onClick={() => { setShowCreate(false); setCreateError(null); }}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search groups..."
            className="w-full rounded-lg border border-white/10 bg-[#1e1c2a] pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Groups list */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-[#1e1c2a] border border-white/[0.07] rounded-2xl animate-pulse"/>
          ))}
        </div>
      )}

      {error && (
        <div className="text-center text-red-400 py-12">Failed to load groups.</div>
      )}

      {!isLoading && !error && groups.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
          <p className="font-medium text-slate-400 mb-1">No groups found</p>
          <p className="text-sm">
            {query ? 'Try a different search term.' : 'Be the first to create one!'}
          </p>
        </div>
      )}

      {!isLoading && !error && groups.length > 0 && (
        <div className="space-y-3">
          {groups.map(g => (
            <Link
              key={g.id}
              href={`/groups/${g.slug}`}
              className="block bg-[#1e1c2a] border border-white/[0.07] hover:border-white/[0.15] rounded-2xl px-5 py-4 transition-colors group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-base font-bold text-white group-hover:text-blue-300 transition-colors truncate">
                      {g.name}
                    </h2>
                    {g.is_private && (
                      <span className="flex-shrink-0 text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">Private</span>
                    )}
                  </div>
                  {g.description && (
                    <p className="text-sm text-slate-400 line-clamp-1">{g.description}</p>
                  )}
                </div>
                <div className="flex-shrink-0 flex flex-col items-end gap-1">
                  <span className="text-sm font-semibold text-white">
                    {g.member_count} {g.member_count === 1 ? 'member' : 'members'}
                  </span>
                  <span className="text-xs text-slate-500">{timeAgo(g.created_at)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
