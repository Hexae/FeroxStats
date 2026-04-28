import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { unifiedSearch } from '@/lib/search-service';

type SearchParams = Promise<{
  q?: string;
}>;

export const metadata: Metadata = {
  title: 'Search - FeroxStats',
  description: 'Search Ferox players, Grand Exchange items, and game updates in one place.',
};

function normalizeQuery(value: string | undefined): string {
  if (!value) return '';
  return value.trim().slice(0, 100);
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const query = normalizeQuery(params.q);
  const response = query
    ? await unifiedSearch(query, { playerLimit: 20, itemLimit: 20, updateLimit: 20 })
    : await unifiedSearch('');

  const { sections, counts } = response;

  // If exactly one result exists and it's a player, jump straight to the profile page.
  if (query && counts.total === 1 && sections.players.length === 1) {
    redirect(sections.players[0].href);
  }

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto w-full max-w-6xl">
        <h1 className="text-3xl font-extrabold text-white">Search</h1>
        <p className="mt-2 text-slate-400">
          Find players, Grand Exchange items, and update posts from one unified search.
        </p>

        <form action="/search" method="get" className="mt-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Search players, items, updates..."
              className="h-11 w-full rounded-xl border border-white/10 bg-[#151320]/90 px-4 text-sm text-slate-200 placeholder:text-slate-500 outline-none transition-colors focus:border-emerald-900/50"
            />
            <button
              type="submit"
              className="h-11 rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-emerald-600"
            >
              Search
            </button>
          </div>
        </form>

        {!query && (
          <p className="mt-8 rounded-xl border border-white/10 bg-[#151320]/70 px-4 py-3 text-sm text-slate-300">
            Enter a term to search across players, items, and updates.
          </p>
        )}

        {query && counts.total === 0 && (
          <p className="mt-8 rounded-xl border border-white/10 bg-[#151320]/70 px-4 py-3 text-sm text-slate-300">
            No results found for &quot;{query}&quot;.
          </p>
        )}

        {query && counts.total > 0 && (
          <div className="mt-8 space-y-7">
            <div className="rounded-xl border border-white/10 bg-[#151320]/70 px-4 py-3 text-sm text-slate-300">
              {counts.total} total matches: {counts.players} players, {counts.items} items, {counts.updates} updates.
            </div>

            {sections.players.length > 0 && (
              <section>
                <h2 className="mb-3 text-lg font-bold text-white">Players</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {sections.players.map((result) => (
                    <Link
                      key={result.id}
                      href={result.href}
                      className="rounded-xl border border-white/10 bg-[#1e1c2a]/70 p-4 transition-colors hover:border-emerald-900/40 hover:bg-[#1e1c2a]/90"
                    >
                      <p className="truncate text-sm font-semibold text-white">{result.label}</p>
                      <p className="mt-1 text-xs text-slate-400">@{result.username}</p>
                      {result.subtitle && (
                        <p className="mt-2 text-xs text-slate-500">{result.subtitle}</p>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {sections.items.length > 0 && (
              <section>
                <h2 className="mb-3 text-lg font-bold text-white">Grand Exchange Items</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {sections.items.map((result) => (
                    <Link
                      key={result.id}
                      href={result.href}
                      className="rounded-xl border border-white/10 bg-[#1e1c2a]/70 p-4 transition-colors hover:border-emerald-900/40 hover:bg-[#1e1c2a]/90"
                    >
                      <p className="truncate text-sm font-semibold text-white">{result.label}</p>
                      {result.subtitle && (
                        <p className="mt-2 text-xs text-slate-500">{result.subtitle}</p>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {sections.updates.length > 0 && (
              <section>
                <h2 className="mb-3 text-lg font-bold text-white">Updates</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {sections.updates.map((result) => (
                    <Link
                      key={result.id}
                      href={result.href}
                      className="rounded-xl border border-white/10 bg-[#1e1c2a]/70 p-4 transition-colors hover:border-emerald-900/40 hover:bg-[#1e1c2a]/90"
                    >
                      <p className="line-clamp-2 text-sm font-semibold text-white">{result.label}</p>
                      {result.subtitle && (
                        <p className="mt-2 text-xs text-slate-500">{result.subtitle}</p>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}