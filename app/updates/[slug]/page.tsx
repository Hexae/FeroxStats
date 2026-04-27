import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ReactNode } from 'react';
import UpdateShareButton from '@/components/UpdateShareButton';
import { getAllPublishedUpdates, getPublishedUpdateBySlug } from '@/lib/updates-service';

type Props = {
  params: Promise<{ slug: string }>;
};

type TocItem = {
  id: string;
  title: string;
  level: 2 | 3;
};

export const revalidate = 300;

function slugifyHeading(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function extractHeadingText(node: ReactNode): string {
  if (typeof node === 'string') {
    return node;
  }

  if (typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map((item) => extractHeadingText(item)).join('');
  }

  if (node && typeof node === 'object' && 'props' in node) {
    const withProps = node as { props?: { children?: ReactNode } };
    return extractHeadingText(withProps.props?.children ?? '');
  }

  return '';
}

function extractToc(markdown: string): TocItem[] {
  const toc: TocItem[] = [];
  const counts = new Map<string, number>();

  for (const rawLine of markdown.split('\n')) {
    const match = rawLine.match(/^(#{2,3})\s+(.+)$/);
    if (!match) {
      continue;
    }

    const level = match[1].length as 2 | 3;
    const title = match[2].trim();
    const base = slugifyHeading(title) || 'section';
    const seen = counts.get(base) ?? 0;
    counts.set(base, seen + 1);

    toc.push({
      id: seen === 0 ? base : `${base}-${seen + 1}`,
      title,
      level,
    });
  }

  return toc;
}

export async function generateStaticParams() {
  const updates = await getAllPublishedUpdates();
  return updates.map((update) => ({ slug: update.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const update = await getPublishedUpdateBySlug(slug);

  if (!update) {
    return {
      title: 'Update Not Found - FeroxStats',
    };
  }

  return {
    title: `${update.title} - Ferox.ps Updates`,
    description: update.summary,
    openGraph: {
      title: update.title,
      description: update.summary,
      images: [{ url: `/updates/${update.slug}/opengraph-image` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: update.title,
      description: update.summary,
      images: [`/updates/${update.slug}/opengraph-image`],
    },
  };
}

export default async function UpdateDetailPage({ params }: Props) {
  const { slug } = await params;
  const update = await getPublishedUpdateBySlug(slug);

  if (!update) {
    notFound();
  }

  const tocItems = extractToc(update.markdown);
  const headingCounts = new Map<string, number>();

  function toHeadingId(rawText: string): string {
    const base = slugifyHeading(rawText) || 'section';
    const seen = headingCounts.get(base) ?? 0;
    headingCounts.set(base, seen + 1);
    return seen === 0 ? base : `${base}-${seen + 1}`;
  }

  return (
    <div className="min-h-screen px-4 py-10 sm:py-12">
      <article className="mx-auto max-w-6xl overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1e1c2a]/85 shadow-[0_12px_60px_rgba(0,0,0,0.35)]">
        <div className="relative h-60 sm:h-72 lg:h-80 bg-emerald-950/20">
          <Image
            src={update.image}
            alt={update.title}
            fill
            sizes="(max-width: 1024px) 100vw, 1024px"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#1e1c2a]/10 via-[#1e1c2a]/60 to-[#1e1c2a]" />
        </div>

        <div className="p-6 sm:p-8 lg:p-10">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-emerald-900/40 bg-emerald-950/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
              {update.category}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-300">
              {update.date}
            </span>
          </div>

          <h1 className="mb-4 text-2xl font-extrabold leading-tight text-white sm:text-3xl lg:text-4xl">
            {update.title}
          </h1>

          <p className="mb-8 max-w-3xl text-slate-300 leading-relaxed sm:text-[15px]">{update.summary}</p>

          <div className="mb-8 flex flex-wrap gap-3">
            <UpdateShareButton title={update.title} />
            <Link
              href="/updates"
              className="inline-flex items-center rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5"
            >
              Back to Latest
            </Link>
            <Link
              href="/updates/archived"
              className="inline-flex items-center rounded-xl border border-emerald-900/40 bg-emerald-950/30 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-900/30"
            >
              Browse Archived Updates
            </Link>
          </div>

          <section className="mb-10 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 sm:p-6">
            <h2 className="mb-4 text-lg font-bold text-white sm:text-xl">At a Glance</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {update.highlights.map((line, index) => (
                <li
                  key={`${index}-${line}`}
                  className="rounded-lg border border-emerald-900/30 bg-emerald-950/20 px-4 py-3 text-sm leading-relaxed text-slate-200"
                >
                  {line}
                </li>
              ))}
            </ul>
          </section>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_240px]">
            <section className="rounded-xl border border-white/[0.06] bg-[#171522]/70 p-5 sm:p-6">
              <h2 className="mb-4 text-lg font-bold text-white sm:text-xl">Full Changelog</h2>
              <div className="space-y-4 text-[15px] leading-relaxed text-slate-200">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h2: ({ children }) => {
                      const text = extractHeadingText(children).trim();
                      const id = toHeadingId(text);
                      return (
                        <h2 id={id} className="mt-7 mb-3 text-lg font-extrabold uppercase tracking-wide text-emerald-300">
                          {children}
                        </h2>
                      );
                    },
                    h3: ({ children }) => {
                      const text = extractHeadingText(children).trim();
                      const id = toHeadingId(text);
                      return (
                        <h3 id={id} className="mt-6 mb-3 text-base font-bold uppercase tracking-wide text-emerald-200">
                          {children}
                        </h3>
                      );
                    },
                    p: ({ children }) => <p className="text-slate-200">{children}</p>,
                    ul: ({ children }) => <ul className="space-y-2">{children}</ul>,
                    ol: ({ children }) => <ol className="space-y-2 list-decimal pl-5">{children}</ol>,
                    li: ({ children }) => <li className="text-slate-200">{children}</li>,
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-300 underline underline-offset-2 hover:text-emerald-200"
                      >
                        {children}
                      </a>
                    ),
                    strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-2 border-emerald-700/50 pl-4 text-slate-300">{children}</blockquote>
                    ),
                    code: ({ children }) => (
                      <code className="rounded bg-black/30 px-1.5 py-0.5 text-emerald-200">{children}</code>
                    ),
                  }}
                >
                  {update.markdown}
                </ReactMarkdown>
              </div>
            </section>

            {tocItems.length > 0 && (
              <aside className="h-fit rounded-xl border border-white/[0.06] bg-[#171522]/70 p-4 lg:sticky lg:top-24">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-emerald-300">On This Update</h3>
                <ul className="space-y-2 text-sm">
                  {tocItems.map((item) => (
                    <li key={item.id} className={item.level === 3 ? 'pl-3' : ''}>
                      <a href={`#${item.id}`} className="text-slate-300 hover:text-emerald-300">
                        {item.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </aside>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}
