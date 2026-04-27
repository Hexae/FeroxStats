import type { Metadata } from 'next';
import Link from 'next/link';
import { getArchivedUpdates } from '@/lib/updates-service';

type SearchParams = Promise<{
  year?: string;
  month?: string;
  page?: string;
}>;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const PAGE_SIZE = 12;

function buildArchiveHref(year?: number, month?: number, page?: number): string {
  const params = new URLSearchParams();

  if (typeof year === 'number' && Number.isFinite(year)) {
    params.set('year', String(year));
  }

  if (month && month >= 1 && month <= 12) {
    params.set('month', String(month));
  }

  if (page && page > 1) {
    params.set('page', String(page));
  }

  const query = params.toString();
  return query ? `/updates/archived?${query}` : '/updates/archived';
}

export const metadata: Metadata = {
  title: 'Archived Updates - FeroxStats',
  description: 'Browse older Ferox.ps game updates that are no longer in the latest cards.',
};

export default async function ArchivedUpdatesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const updates = await getArchivedUpdates();

  const updatesWithParsedDates = updates.map((update) => {
    const date = new Date(update.publishedAtISO);
    return {
      ...update,
      parsed: Number.isNaN(date.getTime())
        ? null
        : { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 },
    };
  });

  const years = Array.from(
    new Set(
      updatesWithParsedDates
        .map((update) => update.parsed?.year)
        .filter((year): year is number => typeof year === 'number'),
    ),
  ).sort((a, b) => b - a);

  const selectedYearRaw = Number(resolvedSearchParams.year);
  const selectedYear = Number.isFinite(selectedYearRaw) && selectedYearRaw > 0 ? selectedYearRaw : undefined;
  const selectedMonthRaw = Number(resolvedSearchParams.month);
  const selectedMonth = selectedMonthRaw >= 1 && selectedMonthRaw <= 12 ? selectedMonthRaw : undefined;

  const filteredUpdates = updatesWithParsedDates.filter((update) => {
    if (!update.parsed) {
      return !selectedYear && !selectedMonth;
    }

    if (selectedYear && update.parsed.year !== selectedYear) {
      return false;
    }

    if (selectedMonth && update.parsed.month !== selectedMonth) {
      return false;
    }

    return true;
  });

  const pageRaw = Number(resolvedSearchParams.page);
  const totalPages = Math.max(1, Math.ceil(filteredUpdates.length / PAGE_SIZE));
  const currentPage = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.min(pageRaw, totalPages) : 1;
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageUpdates = filteredUpdates.slice(pageStart, pageStart + PAGE_SIZE);

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">Archived Updates</h1>
            <p className="text-slate-400">
              Showing {filteredUpdates.length} archived updates
              {selectedYear ? ` from ${selectedYear}` : ''}
              {selectedMonth ? ` in ${MONTHS[selectedMonth - 1]}` : ''}.
            </p>
          </div>
          <Link
            href="/updates"
            className="inline-flex items-center rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5"
          >
            Back to Latest Updates
          </Link>
        </div>

        <section className="mb-8 rounded-2xl border border-white/[0.07] bg-[#1e1c2a]/80 p-6 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
          <div className="mb-6">
            <h3 className="mb-3 text-center text-xl font-bold text-white">Select a year</h3>
            <div className="rounded-xl border border-white/[0.07] bg-[#151320]/70 p-3">
              <div className="flex flex-wrap justify-center gap-2">
                <Link
                  href={buildArchiveHref(undefined, selectedMonth)}
                  className={`rounded-md px-3 py-2 text-base font-semibold leading-none border transition-colors ${
                    !selectedYear
                      ? 'border-emerald-800/70 bg-emerald-900/40 text-emerald-200'
                      : 'border-white/10 bg-[#0f0d17] text-slate-300 hover:border-emerald-900/40 hover:text-emerald-300'
                  }`}
                >
                  All
                </Link>
                {years.map((year) => {
                  const isActive = year === selectedYear;
                  return (
                    <Link
                      key={year}
                      href={isActive ? buildArchiveHref(undefined, selectedMonth) : buildArchiveHref(year, selectedMonth)}
                      className={`rounded-md px-3 py-2 text-base font-semibold leading-none border transition-colors ${
                        isActive
                          ? 'border-emerald-800/70 bg-emerald-900/40 text-emerald-200'
                          : 'border-white/10 bg-[#0f0d17] text-slate-300 hover:border-emerald-900/40 hover:text-emerald-300'
                      }`}
                    >
                      {year}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-center text-xl font-bold text-white">Select a month</h3>
            <div className="rounded-xl border border-white/[0.07] bg-[#151320]/70 p-3">
              <div className="flex flex-wrap justify-center gap-2">
                <Link
                  href={buildArchiveHref(selectedYear, undefined)}
                  className={`rounded-md px-3 py-2 text-base font-semibold leading-none border transition-colors ${
                    !selectedMonth
                      ? 'border-emerald-800/70 bg-emerald-900/40 text-emerald-200'
                      : 'border-white/10 bg-[#0f0d17] text-slate-300 hover:border-emerald-900/40 hover:text-emerald-300'
                  }`}
                >
                  All
                </Link>
                {MONTHS.map((monthName, index) => {
                  const month = index + 1;
                  const isActive = month === selectedMonth;

                  return (
                    <Link
                      key={monthName}
                      href={isActive ? buildArchiveHref(selectedYear, undefined) : buildArchiveHref(selectedYear, month)}
                      className={`rounded-md px-3 py-2 text-base font-semibold leading-none border transition-colors ${
                        isActive
                          ? 'border-emerald-800/70 bg-emerald-900/40 text-emerald-200'
                          : 'border-white/10 bg-[#0f0d17] text-slate-300 hover:border-emerald-900/40 hover:text-emerald-300'
                      }`}
                    >
                      {monthName}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pageUpdates.map((update) => (
            <Link
              key={update.slug}
              href={`/updates/${update.slug}`}
              className="rounded-2xl border border-white/[0.07] bg-[#1e1c2a]/80 p-5 transition-colors hover:border-emerald-900/40"
            >
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                {update.date} · {update.category}
              </p>
              <h2 className="text-base font-bold text-white mb-2">{update.title}</h2>
              <p className="text-sm text-slate-400 leading-relaxed">{update.summary}</p>
            </Link>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              href={buildArchiveHref(selectedYear, selectedMonth, Math.max(1, currentPage - 1))}
              aria-disabled={currentPage <= 1}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                currentPage <= 1
                  ? 'pointer-events-none border-white/10 text-slate-600'
                  : 'border-white/10 text-slate-200 hover:bg-white/5'
              }`}
            >
              Previous
            </Link>
            <span className="text-sm text-slate-400">Page {currentPage} of {totalPages}</span>
            <Link
              href={buildArchiveHref(selectedYear, selectedMonth, Math.min(totalPages, currentPage + 1))}
              aria-disabled={currentPage >= totalPages}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                currentPage >= totalPages
                  ? 'pointer-events-none border-white/10 text-slate-600'
                  : 'border-white/10 text-slate-200 hover:bg-white/5'
              }`}
            >
              Next
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
