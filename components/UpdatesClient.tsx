'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { SiteUpdate } from '@/lib/updates-service';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightText(text: string, query: string) {
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 0);

  if (terms.length === 0) {
    return text;
  }

  const pattern = terms.map(escapeRegExp).join('|');
  const regex = new RegExp(`(${pattern})`, 'ig');
  const parts = text.split(regex);

  return parts.map((part, index) => {
    const isMatch = terms.some((term) => part.toLowerCase() === term);

    if (!isMatch) {
      return <span key={`${part}-${index}`}>{part}</span>;
    }

    return (
      <mark
        key={`${part}-${index}`}
        className="rounded bg-emerald-900/50 px-1 py-[1px] text-emerald-200"
      >
        {part}
      </mark>
    );
  });
}

type UpdatesClientProps = {
  updates: SiteUpdate[];
};

export default function UpdatesClient({ updates }: UpdatesClientProps) {
  const [query, setQuery] = useState('');

  const normalizedQuery = query.trim().toLowerCase();

  const visibleUpdates = useMemo(() => {
    if (!normalizedQuery) {
      return updates.slice(0, 6);
    }

    return updates.filter((update) => {
      const haystack = [
        update.title,
        update.summary,
        update.category,
        update.date,
        ...update.details,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery, updates]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Recent Updates Cards ── */}
      <section className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Latest Updates</h2>
          </div>
          <Link
            href="/updates/archived"
            className="inline-flex items-center rounded-xl border border-emerald-900/40 bg-emerald-950/30 px-4 py-2 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-900/30 hover:text-emerald-200"
          >
            Archived Updates
          </Link>
        </div>

        <div className="mb-6 max-w-xl">
          <label htmlFor="updates-search" className="mb-2 block text-sm font-semibold text-slate-300">
            Search updates by keyword
          </label>
          <input
            id="updates-search"
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try: wilderness, tournament, yama, slayer..."
            className="w-full rounded-xl border border-white/10 bg-[#151320]/90 px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 outline-none transition-colors focus:border-emerald-900/50"
          />
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {visibleUpdates.map((update) => (
            <Link
              key={update.slug}
              href={`/updates/${update.slug}`}
              className="group relative bg-[#1e1c2a]/80 border border-white/[0.07] hover:border-emerald-900/30 rounded-2xl overflow-hidden card-hover transition-all"
            >
              <div className="relative h-44 overflow-hidden bg-emerald-950/20">
                <Image
                  src={update.image}
                  alt={update.title}
                  fill
                  sizes="(max-width: 1024px) 100vw, 33vw"
                  className="object-cover transition duration-300 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-[#1e1c2a]/0 to-[#1e1c2a]/80" />
              </div>
              <div className="p-6 relative z-10">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                  {highlightText(update.date, normalizedQuery)} · {highlightText(update.category, normalizedQuery)}
                </p>
                <h3 className="font-bold text-white mb-3 text-lg leading-tight group-hover:text-emerald-400 transition-colors">
                  {highlightText(update.title, normalizedQuery)}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {highlightText(update.summary, normalizedQuery)}
                </p>
              </div>
            </Link>
          ))}
        </div>

        {normalizedQuery && visibleUpdates.length === 0 && (
          <p className="mt-6 rounded-xl border border-white/10 bg-[#151320]/70 px-4 py-3 text-sm text-slate-300">
            No updates matched your keyword search.
          </p>
        )}
      </section>
    </div>
  );
}
