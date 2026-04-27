import { unstable_cache } from 'next/cache';
import { FEROX_UPDATES, type FeroxUpdate } from './ferox-updates';
import { serviceClient } from './supabase-service';
import type { Database } from './database.types';

type GameUpdateRow = Database['public']['Tables']['game_updates']['Row'];

export type SiteUpdate = FeroxUpdate & {
  markdown: string;
  publishedAtISO: string;
  isPublished: boolean;
};

const DEFAULT_IMAGE = '/snapshot.png';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function parseRawDateToISO(rawDate: string, fallbackId: number): string {
  const value = rawDate.trim();
  const slashMatch = value.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?:\s*(AM|PM))?)?/i,
  );

  if (slashMatch) {
    const first = Number(slashMatch[1]);
    const second = Number(slashMatch[2]);
    const year = Number(slashMatch[3]);

    let day = first;
    let month = second;

    if (first <= 12 && second > 12) {
      month = first;
      day = second;
    }

    let hour = Number(slashMatch[4] ?? 0);
    const minute = Number(slashMatch[5] ?? 0);
    const meridiem = slashMatch[6]?.toUpperCase();

    if (meridiem === 'PM' && hour < 12) {
      hour += 12;
    }
    if (meridiem === 'AM' && hour === 12) {
      hour = 0;
    }

    const iso = new Date(Date.UTC(year, month - 1, day, hour, minute));
    if (!Number.isNaN(iso.getTime())) {
      return iso.toISOString();
    }
  }

  const namedDate = new Date(value);
  if (!Number.isNaN(namedDate.getTime())) {
    return namedDate.toISOString();
  }

  return new Date(Date.UTC(2025, 0, Math.max(1, fallbackId), 0, 0, 0)).toISOString();
}

function formatDateLabel(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function cleanMarkdownLine(line: string): string {
  return line
    .replace(/^[-*+]\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .replace(/^#+\s*/, '')
    .replace(/^>\s*/, '')
    .trim();
}

function markdownToDetails(markdown: string): string[] {
  return markdown
    .split('\n')
    .map((line) => cleanMarkdownLine(line))
    .filter((line) => line.length > 0);
}

function toSummary(details: string[], fallback?: string | null): string {
  const meaningful = details.find((line) => line.length > 8);
  if (meaningful) {
    return meaningful;
  }

  return (fallback ?? '').trim() || 'No summary available for this update.';
}

function toHighlights(details: string[]): string[] {
  const highlights = details.filter((line) => line.length > 0).slice(0, 5);
  return highlights.length > 0 ? highlights : ['No highlight lines were detected for this update.'];
}

function fromStaticUpdate(update: FeroxUpdate): SiteUpdate {
  const markdown = ['## Patch Notes', ...update.details.map((line) => `- ${line}`)].join('\n');
  const iso = parseRawDateToISO(update.date, update.id);

  return {
    ...update,
    markdown,
    date: formatDateLabel(iso),
    publishedAtISO: iso,
    isPublished: true,
  };
}

function fromRow(row: GameUpdateRow, fallbackId = 0): SiteUpdate {
  const iso = new Date(row.published_at).toISOString();
  const details = markdownToDetails(row.markdown);
  const title = row.title.trim();

  return {
    id: row.id ?? fallbackId,
    slug: row.slug || slugify(title),
    date: formatDateLabel(iso),
    category: row.category?.trim() || 'Game Update',
    title,
    summary: toSummary(details, row.summary),
    image: row.image?.trim() || DEFAULT_IMAGE,
    highlights: toHighlights(details),
    details,
    markdown: row.markdown,
    publishedAtISO: iso,
    isPublished: row.is_published,
  };
}

const getCachedSupabasePublishedUpdates = unstable_cache(
  async (): Promise<GameUpdateRow[] | null> => {
    try {
      const { data, error } = await serviceClient()
        .from('game_updates')
        .select('id, slug, title, summary, category, image, markdown, published_at, is_published, created_at, updated_at')
        .eq('is_published', true)
        .order('published_at', { ascending: false });

      if (error) {
        console.error('[updates-service] Failed to load published updates:', error.message);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[updates-service] Unexpected Supabase error:', error);
      return null;
    }
  },
  ['published-game-updates'],
  { revalidate: 300 },
);

export async function getAllPublishedUpdates(): Promise<SiteUpdate[]> {
  const supabaseRows = await getCachedSupabasePublishedUpdates();

  if (supabaseRows && supabaseRows.length > 0) {
    return supabaseRows.map((row, index) => fromRow(row, index + 1));
  }

  return [...FEROX_UPDATES]
    .map(fromStaticUpdate)
    .sort((a, b) => new Date(b.publishedAtISO).getTime() - new Date(a.publishedAtISO).getTime());
}

export async function getLatestUpdates(limit = 6): Promise<SiteUpdate[]> {
  const updates = await getAllPublishedUpdates();
  return updates.slice(0, limit);
}

export async function getArchivedUpdates(): Promise<SiteUpdate[]> {
  const updates = await getAllPublishedUpdates();
  return updates.slice(3);
}

export async function getPublishedUpdateBySlug(slug: string): Promise<SiteUpdate | undefined> {
  const updates = await getAllPublishedUpdates();
  return updates.find((update) => update.slug === slug);
}

export function toISODate(value: string): string {
  return parseRawDateToISO(value, 1);
}
