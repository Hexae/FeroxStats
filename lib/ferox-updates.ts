import { FULL_UPDATE_LINES } from './ferox-update-lines';
import { UPDATE_METADATA_BY_ID } from './ferox-update-metadata';

export type FeroxUpdate = {
  id: number;
  slug: string;
  date: string;
  category: string;
  title: string;
  summary: string;
  image: string;
  highlights: string[];
  details: string[];
};

const categories = [
  'Game Update',
  'Wilderness',
  'Raids',
  'Bosses',
  'Minigames',
  'Quality of Life',
] as const;

const images = ['/snapshot.png', '/hiscores.png', '/skills.png'] as const;

function toSlug(id: number): string {
  return `update-${id.toString().padStart(2, '0')}`;
}

function normalizeDate(rawDate?: string): string {
  if (!rawDate) {
    return 'Unknown date';
  }

  return rawDate.trim();
}

function normalizeTitle(id: number, title?: string): string {
  if (!title || !title.trim()) {
    return `Game Update #${id}`;
  }

  return title.trim();
}

function cleanLine(line: string): string {
  return line
    .replace(/^[-*]\s+/, '')
    .replace(/^#+\s*/, '')
    .replace(/^>\s*/, '')
    .trim();
}

function isHeadingLike(line: string): boolean {
  const lower = line.toLowerCase();
  if (!lower) {
    return true;
  }

  if (line.startsWith('http://') || line.startsWith('https://')) {
    return true;
  }

  const headingWords = new Set([
    'patch notes',
    'fixes',
    'fixes #2',
    'additions',
    'additions / content',
    'additions & content',
    'balancing & adjustments',
    'other changes',
    'other updates',
    'other additions',
    'other fixes',
    'wilderness',
    'bosses',
    'skills',
    'store',
    'competition',
    'rewards',
    'items',
    'raids',
    'minigames',
    'plugins',
    'easter event',
    'christmas event',
    'sanctum bounties',
  ]);

  return headingWords.has(lower);
}

function getSummary(lines: string[], fallbackSummary?: string): string {
  for (const raw of lines) {
    const line = cleanLine(raw);
    if (!line || isHeadingLike(line)) {
      continue;
    }

    return line;
  }

  return fallbackSummary?.trim() || 'No summary available for this update.';
}

function getHighlights(lines: string[]): string[] {
  const highlights: string[] = [];

  for (const raw of lines) {
    const line = cleanLine(raw);
    if (!line || isHeadingLike(line)) {
      continue;
    }

    highlights.push(line);
    if (highlights.length === 5) {
      break;
    }
  }

  if (highlights.length > 0) {
    return highlights;
  }

  return ['No highlight lines were detected for this update.'];
}

function makeFallbackUpdate(id: number): FeroxUpdate {
  const category = categories[(id - 1) % categories.length];
  const image = images[(id - 1) % images.length];

  return {
    id,
    slug: toSlug(id),
    date: 'Unknown date',
    category,
    title: `Game Update #${id}`,
    summary: `Ferox.ps update #${id} information will be added soon.`,
    image,
    highlights: [`Summary for update #${id} is currently unavailable.`],
    details: [`No details found for update #${id}.`],
  };
}

function makeUpdateFromSource(id: number): FeroxUpdate {
  const metadata = UPDATE_METADATA_BY_ID[id];
  const rawLines = FULL_UPDATE_LINES[id];

  if (!metadata || !rawLines || rawLines.length === 0) {
    return makeFallbackUpdate(id);
  }

  const cleanedDetails = rawLines.map(cleanLine).filter((line) => line.length > 0);
  const image = images[(id - 1) % images.length];

  return {
    id,
    slug: toSlug(id),
    date: normalizeDate(metadata.rawDate),
    category: 'Game Update',
    title: normalizeTitle(id, metadata.title),
    summary: getSummary(cleanedDetails, metadata.summary),
    image,
    highlights: getHighlights(cleanedDetails),
    details: cleanedDetails,
  };
}

const MAX_UPDATES = 36;

export const FEROX_UPDATES: FeroxUpdate[] = Array.from({ length: MAX_UPDATES }, (_, index) =>
  makeUpdateFromSource(index + 1),
).sort((a, b) => b.id - a.id);

export const LATEST_UPDATES = FEROX_UPDATES.slice(0, 3);
export const ARCHIVED_UPDATES = FEROX_UPDATES.slice(3);

export function getUpdateBySlug(slug: string): FeroxUpdate | undefined {
  return FEROX_UPDATES.find((update) => update.slug === slug);
}

