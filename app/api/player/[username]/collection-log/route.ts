    import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase-service';
import { BOSS_LOOT_TABLE } from '@/lib/boss-loot-table';

const TRACKED_EVENT_TYPES = ['RARE_DROP', 'PET_OBTAINED'] as const;
const PAGE_SIZE = 1000;

type CollectionEventType = (typeof TRACKED_EVENT_TYPES)[number];

interface CollectionEventRow {
  event_type: CollectionEventType | string | null;
  player: string | null;
  details: unknown;
  source: string | null;
  boss: string | null;
  item: string | null;
  pet: string | null;
  skill: string | null;
  cause: string | null;
  kills: string | null;
  image_url: string | null;
  timestamp: string | null;
}

interface CollectionLogItem {
  key: string;
  name: string;
  eventType: CollectionEventType;
  rarityTier: 'mythic' | 'legendary' | 'epic' | 'rare' | 'uncommon' | 'common' | 'unknown';
  dropRateOdds: string | null;
  dropRateDenominator: number | null;
  obtainedCount: number;
  firstObtainedAt: string | null;
  lastObtainedAt: string | null;
  firstKc: number | null;
  lastKc: number | null;
  imageUrl: string | null;
}

interface CollectionLogCategory {
  key: string;
  label: string;
  itemCount: number;
  eventCount: number;
  maxKills: number | null;
  firstObtainedAt: string | null;
  lastObtainedAt: string | null;
  items: CollectionLogItem[];
  knownDrops: string[];
  knownPets: string[];
}

type CollectionApiResponse = {
  configured: boolean;
  message?: string;
  summary: {
    totalItems: number;
    totalCategories: number;
    totalEvents: number;
    firstObtainedAt: string | null;
    lastObtainedAt: string | null;
  };
  categories: CollectionLogCategory[];
};

type QueryError = { code?: string; message?: string } | null;
type QueryResult = PromiseLike<{ data: CollectionEventRow[] | null; error: QueryError }>;

interface CollectionRangeQuery {
  range: (from: number, to: number) => QueryResult;
}

interface CollectionFilterQuery {
  eq: (column: string, value: string) => CollectionRangeQuery;
  ilike: (column: string, value: string) => CollectionRangeQuery;
}

interface CollectionDb {
  from: (table: string) => {
    select: (columns: string) => {
      in: (column: string, values: readonly string[]) => {
        order: (column: string, options: { ascending: boolean; nullsFirst: boolean }) => CollectionFilterQuery;
      };
    };
  };
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Derive a local public image path for a collection log item/pet.
 * Pets use /collection_logs/ (which includes pet images).
 * Drops use /items/ (consistent OSRS-canonical naming).
 */
function localItemImageUrl(eventType: CollectionEventType, itemName: string): string {
  const t = itemName.trim();
  const filename = (t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()).replace(/\s+/g, '_') + '.png';
  return eventType === 'PET_OBTAINED'
    ? `/collection_logs/${filename}`
    : `/items/${filename}`;
}

function cleanText(value: string | null | undefined): string | null {
  const next = value?.trim();
  return next ? next : null;
}

function parseKills(value: string | null): number | null {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseKillsFromRaw(details: unknown): number | null {
  let raw: string | null = null;
  if (typeof details === 'string') {
    raw = details;
  } else if (typeof details === 'object' && details !== null && !Array.isArray(details)) {
    const r = (details as Record<string, unknown>).raw;
    if (typeof r === 'string') raw = r;
  }
  if (!raw) return null;
  // Match "(N kills)" anywhere in the string, e.g. "Callisto (61 kills)"
  const m = raw.match(/(\d[\d,]*)\s+kills\b/i);
  if (!m) return null;
  const n = Number.parseInt((m[1] ?? '').replace(/,/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseColumnError(error: QueryError): string {
  const message = error?.message ?? '';
  const match = message.match(/column\s+"?([a-zA-Z0-9_]+)"?/i);
  return match?.[1]?.toLowerCase() ?? '';
}

function parseRateText(input: string | null | undefined): { oddsText: string; denominator: number | null } | null {
  if (!input) return null;

  const oddsMatch = input.match(/1\s*\/\s*([\d,]+)/i);
  if (oddsMatch) {
    const denominator = Number.parseInt((oddsMatch[1] ?? '').replace(/,/g, ''), 10);
    return {
      oddsText: `1/${(oddsMatch[1] ?? '').replace(/,/g, '')}`,
      denominator: Number.isFinite(denominator) && denominator > 0 ? denominator : null,
    };
  }

  const chanceMatch = input.match(/([\d.]+)\s*%/);
  if (chanceMatch) {
    const pct = Number.parseFloat(chanceMatch[1] ?? '');
    if (Number.isFinite(pct) && pct > 0) {
      const denominator = Math.round(100 / pct);
      return {
        oddsText: `~1/${denominator}`,
        denominator,
      };
    }
  }

  return null;
}

function parseRateFromObject(details: Record<string, unknown>): { oddsText: string | null; denominator: number | null } {
  const candidates = [details.rate, details.drop_rate, details.odds, details.chance, details.rarity]
    .filter((value): value is string | number => value !== undefined && value !== null)
    .map((value) => String(value));

  for (const candidate of candidates) {
    const parsedRate = parseRateText(candidate);
    if (parsedRate) return parsedRate;
  }

  const rawValue = details.raw;
  if (typeof rawValue === 'string') {
    const parsedRaw = parseRateText(rawValue);
    if (parsedRaw) return parsedRaw;
  }

  return { oddsText: null, denominator: null };
}

function parseDropRate(row: CollectionEventRow): { oddsText: string | null; denominator: number | null } {
  const detailsText = row.details;
  if (!detailsText) {
    return { oddsText: null, denominator: null };
  }

  if (typeof detailsText === 'object' && detailsText !== null && !Array.isArray(detailsText)) {
    return parseRateFromObject(detailsText as Record<string, unknown>);
  }

  if (typeof detailsText !== 'string') {
    return { oddsText: null, denominator: null };
  }

  try {
    const parsed = JSON.parse(detailsText);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parseRateFromObject(parsed as Record<string, unknown>);
    }
  } catch {
    // Details are not always valid JSON text.
  }

  return parseRateText(detailsText) ?? { oddsText: null, denominator: null };
}

function toRarityTier(
  eventType: CollectionEventType,
  denominator: number | null,
): CollectionLogItem['rarityTier'] {
  if (denominator == null) {
    return eventType === 'PET_OBTAINED' ? 'mythic' : 'unknown';
  }
  if (denominator >= 5000) return 'mythic';
  if (denominator >= 1000) return 'legendary';
  if (denominator >= 512) return 'epic';
  if (denominator >= 128) return 'rare';
  if (denominator >= 32) return 'uncommon';
  return 'common';
}

function sortIsoAsc(a: string | null, b: string | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
}

function getItemName(row: CollectionEventRow): string {
  return cleanText(row.item) ?? cleanText(row.pet) ?? 'Unknown item';
}

function getCategoryLabel(row: CollectionEventRow): string {
  return (
    cleanText(row.boss) ??
    cleanText(row.source) ??
    (row.event_type === 'PET_OBTAINED' ? cleanText(row.skill) : null) ??
    cleanText(row.skill) ??
    cleanText(row.cause) ??
    'Miscellaneous'
  );
}

async function fetchCollectionRows(username: string): Promise<CollectionEventRow[]> {
  const db = serviceClient() as unknown as CollectionDb;

  const rows: CollectionEventRow[] = [];
  let from = 0;
  let useNormalizedPlayerKey = true;
  let selectedColumns = [
    'event_type',
    'player',
    'details',
    'source',
    'boss',
    'item',
    'pet',
    'skill',
    'cause',
    'kills',
    'image_url',
    'timestamp',
  ];
  const normalizedPlayer = username.toLowerCase();

  while (true) {
    const baseQuery = db
      .from('pvm_events')
      .select(selectedColumns.join(', '))
      .in('event_type', TRACKED_EVENT_TYPES)
      .order('timestamp', { ascending: false, nullsFirst: false });

    const { data, error } = await (useNormalizedPlayerKey
      ? baseQuery.eq('player_key', normalizedPlayer).range(from, from + PAGE_SIZE - 1)
      : baseQuery.ilike('player', username).range(from, from + PAGE_SIZE - 1));

    if (error) {
      if (error.code === '42703') {
        const missingColumn = parseColumnError(error);

        if (useNormalizedPlayerKey && missingColumn === 'player_key') {
          useNormalizedPlayerKey = false;
          continue;
        }

        if (missingColumn && selectedColumns.includes(missingColumn)) {
          selectedColumns = selectedColumns.filter((column) => column !== missingColumn);
          continue;
        }
      }
      throw error;
    }

    const batch = data ?? [];
    rows.push(...batch);

    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

function buildCollectionResponse(rows: CollectionEventRow[]): CollectionApiResponse {
  const categories = new Map<
    string,
    CollectionLogCategory & { itemsByKey: Map<string, CollectionLogItem> }
  >();

  let firstObtainedAt: string | null = null;
  let lastObtainedAt: string | null = null;
  let totalEvents = 0;

  for (const row of rows) {
    const eventType = row.event_type === 'PET_OBTAINED' ? 'PET_OBTAINED' : 'RARE_DROP';
    const categoryLabel = getCategoryLabel(row);
    const categoryKey = normalizeKey(categoryLabel);
    const itemName = getItemName(row);
    const itemKey = normalizeKey(itemName);
    const timestamp = cleanText(row.timestamp);
    const kills = parseKills(row.kills) ?? parseKillsFromRaw(row.details);
    const rate = parseDropRate(row);

    if (timestamp) {
      firstObtainedAt = !firstObtainedAt || sortIsoAsc(timestamp, firstObtainedAt) < 0 ? timestamp : firstObtainedAt;
      lastObtainedAt = !lastObtainedAt || sortIsoAsc(timestamp, lastObtainedAt) > 0 ? timestamp : lastObtainedAt;
    }

    totalEvents += 1;

    let category = categories.get(categoryKey);
    if (!category) {
      // Look up known loot for this boss/category
      const bossLoot = BOSS_LOOT_TABLE[categoryLabel] ?? { drops: [], pets: [] };
      category = {
        key: categoryKey,
        label: categoryLabel,
        itemCount: 0,
        eventCount: 0,
        maxKills: kills,
        firstObtainedAt: timestamp,
        lastObtainedAt: timestamp,
        items: [],
        knownDrops: bossLoot.drops,
        knownPets: bossLoot.pets,
        itemsByKey: new Map<string, CollectionLogItem>(),
      };
      categories.set(categoryKey, category);
    }

    category.eventCount += 1;
    category.maxKills = kills == null || (category.maxKills != null && category.maxKills >= kills)
      ? category.maxKills
      : kills;
    category.firstObtainedAt = !category.firstObtainedAt || sortIsoAsc(timestamp, category.firstObtainedAt) < 0
      ? timestamp
      : category.firstObtainedAt;
    category.lastObtainedAt = !category.lastObtainedAt || sortIsoAsc(timestamp, category.lastObtainedAt) > 0
      ? timestamp
      : category.lastObtainedAt;

    let item = category.itemsByKey.get(itemKey);
    if (!item) {
      item = {
        key: itemKey,
        name: itemName,
        eventType,
        rarityTier: toRarityTier(eventType, rate.denominator),
        dropRateOdds: rate.oddsText,
        dropRateDenominator: rate.denominator,
        obtainedCount: 0,
        firstObtainedAt: timestamp,
        lastObtainedAt: timestamp,
        firstKc: kills,
        lastKc: kills,
        imageUrl: cleanText(row.image_url) ?? localItemImageUrl(eventType, itemName),
      };
      category.itemsByKey.set(itemKey, item);
      category.itemCount += 1;
    }

    item.obtainedCount += 1;
    item.firstObtainedAt = !item.firstObtainedAt || sortIsoAsc(timestamp, item.firstObtainedAt) < 0
      ? timestamp
      : item.firstObtainedAt;
    item.lastObtainedAt = !item.lastObtainedAt || sortIsoAsc(timestamp, item.lastObtainedAt) > 0
      ? timestamp
      : item.lastObtainedAt;
    if (kills != null) {
      if (item.firstKc == null || kills < item.firstKc) item.firstKc = kills;
      if (item.lastKc == null || kills > item.lastKc) item.lastKc = kills;
    }
    // Prefer an explicit DB URL over the derived local path
    const dbUrl = cleanText(row.image_url);
    if (dbUrl) item.imageUrl = dbUrl;
    if (rate.denominator != null) {
      const shouldReplace = item.dropRateDenominator == null || rate.denominator > item.dropRateDenominator;
      if (shouldReplace) {
        item.dropRateDenominator = rate.denominator;
        item.dropRateOdds = rate.oddsText;
        item.rarityTier = toRarityTier(eventType, rate.denominator);
      }
    }
  }

  const categoryList = Array.from(categories.values())
    .map(({ itemsByKey, ...category }) => ({
      ...category,
      items: Array.from(itemsByKey.values()).sort((left, right) => {
        const dateOrder = sortIsoAsc(right.lastObtainedAt, left.lastObtainedAt);
        return dateOrder !== 0 ? dateOrder : left.name.localeCompare(right.name);
      }),
    }))
    .sort((left, right) => left.label.localeCompare(right.label));

  return {
    configured: true,
    summary: {
      totalItems: categoryList.reduce((sum, category) => sum + category.itemCount, 0),
      totalCategories: categoryList.length,
      totalEvents,
      firstObtainedAt,
      lastObtainedAt,
    },
    categories: categoryList,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const decoded = decodeURIComponent(username);

  try {
    const rows = await fetchCollectionRows(decoded);
    return NextResponse.json(buildCollectionResponse(rows));
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
    const message = typeof error === 'object' && error && 'message' in error ? String(error.message) : '';

    if (code === '42P01' || /pvm_events/i.test(message)) {
      return NextResponse.json({
        configured: false,
        message: 'Collection log data is not available yet.',
        summary: {
          totalItems: 0,
          totalCategories: 0,
          totalEvents: 0,
          firstObtainedAt: null,
          lastObtainedAt: null,
        },
        categories: [],
      } satisfies CollectionApiResponse);
    }

    // Return a safe payload for query failures instead of bubbling a 500 to the UI.
    // This keeps the player page usable even when DB schema/state is mid-migration.
    if (code) {
      return NextResponse.json({
        configured: false,
        message: 'Collection log is temporarily unavailable due to a data query issue.',
        summary: {
          totalItems: 0,
          totalCategories: 0,
          totalEvents: 0,
          firstObtainedAt: null,
          lastObtainedAt: null,
        },
        categories: [],
      } satisfies CollectionApiResponse);
    }

    return NextResponse.json({
      configured: false,
      message: 'Collection log is temporarily unavailable.',
      summary: {
        totalItems: 0,
        totalCategories: 0,
        totalEvents: 0,
        firstObtainedAt: null,
        lastObtainedAt: null,
      },
      categories: [],
    } satisfies CollectionApiResponse);
  }
}