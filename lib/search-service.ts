import { serviceClient } from '@/lib/supabase-service';
import { getAllPublishedUpdates } from '@/lib/updates-service';
import {
  createEmptyUnifiedSearchResponse,
  type ItemSearchResult,
  type PlayerSearchResult,
  type UnifiedSearchResponse,
  type UpdateSearchResult,
} from './search-types';

type UnifiedSearchOptions = {
  playerLimit?: number;
  itemLimit?: number;
  updateLimit?: number;
};

const DEFAULT_LIMITS = {
  player: 6,
  item: 6,
  update: 4,
} as const;

const MAX_LIMIT = 25;

function clampLimit(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.floor(value as number), 1), MAX_LIMIT);
}

function normalizeQuery(rawQuery: string): string {
  return rawQuery.trim().toLowerCase();
}

async function searchPlayers(query: string, limit: number): Promise<PlayerSearchResult[]> {
  const db = serviceClient();
  const like = `%${query}%`;

  const [usernameMatch, displayNameMatch] = await Promise.all([
    db
      .from('players')
      .select('username, display_name, overall_rank')
      .ilike('username', like)
      .order('overall_rank', { ascending: true })
      .limit(limit),
    db
      .from('players')
      .select('username, display_name, overall_rank')
      .ilike('display_name', like)
      .order('overall_rank', { ascending: true })
      .limit(limit),
  ]);

  const merged = [...(usernameMatch.data ?? []), ...(displayNameMatch.data ?? [])];
  const deduped = new Map<string, PlayerSearchResult>();

  for (const row of merged) {
    const username = row.username?.trim().toLowerCase();
    if (!username) continue;

    const displayName = row.display_name?.trim() || username;
    const overallRank = Number.isFinite(row.overall_rank) && row.overall_rank > 0
      ? row.overall_rank
      : null;

    deduped.set(username, {
      id: `player:${username}`,
      type: 'player',
      label: displayName,
      subtitle: overallRank ? `Rank #${overallRank.toLocaleString()}` : 'Player',
      href: `/player/${encodeURIComponent(username)}`,
      username,
      displayName,
      overallRank,
    });
  }

  return Array.from(deduped.values())
    .sort((a, b) => {
      if (a.overallRank === null && b.overallRank === null) return a.label.localeCompare(b.label);
      if (a.overallRank === null) return 1;
      if (b.overallRank === null) return -1;
      return a.overallRank - b.overallRank;
    })
    .slice(0, limit);
}

async function searchItems(query: string, limit: number): Promise<ItemSearchResult[]> {
  const db = serviceClient();
  const like = `%${query}%`;
  const scanLimit = Math.min(Math.max(limit * 20, 60), 400);

  const { data } = await db
    .from('trade_history')
    .select('item_id, item_name, traded_at')
    .ilike('item_name', like)
    .order('traded_at', { ascending: false })
    .limit(scanLimit);

  const deduped = new Map<string, ItemSearchResult>();
  for (const row of data ?? []) {
    const itemName = row.item_name?.trim();
    if (!itemName) continue;

    const key = itemName.toLowerCase();
    if (deduped.has(key)) continue;

    deduped.set(key, {
      id: `item:${key}`,
      type: 'item',
      label: itemName,
      subtitle: 'Grand Exchange item',
      href: `/ge/item/${encodeURIComponent(itemName)}`,
      itemName,
      itemId: Number.isFinite(row.item_id) ? row.item_id : null,
      lastTradedAt: row.traded_at ?? null,
    });
  }

  return Array.from(deduped.values()).slice(0, limit);
}

async function searchUpdates(query: string, limit: number): Promise<UpdateSearchResult[]> {
  const updates = await getAllPublishedUpdates();

  return updates
    .filter((update) => {
      const haystack = [
        update.title,
        update.summary,
        update.category,
        ...update.details,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    })
    .slice(0, limit)
    .map<UpdateSearchResult>((update) => ({
      id: `update:${update.slug}`,
      type: 'update',
      label: update.title,
      subtitle: `${update.category} · ${update.date}`,
      href: `/updates/${update.slug}`,
      slug: update.slug,
      category: update.category,
      publishedAtISO: update.publishedAtISO,
    }));
}

export async function unifiedSearch(
  rawQuery: string,
  options: UnifiedSearchOptions = {},
): Promise<UnifiedSearchResponse> {
  const query = rawQuery.trim();
  const normalized = normalizeQuery(query);

  if (!normalized || normalized.length > 100) {
    return createEmptyUnifiedSearchResponse(query);
  }

  const playerLimit = clampLimit(options.playerLimit, DEFAULT_LIMITS.player);
  const itemLimit = clampLimit(options.itemLimit, DEFAULT_LIMITS.item);
  const updateLimit = clampLimit(options.updateLimit, DEFAULT_LIMITS.update);

  const [playersResult, itemsResult, updatesResult] = await Promise.allSettled([
    searchPlayers(normalized, playerLimit),
    searchItems(normalized, itemLimit),
    searchUpdates(normalized, updateLimit),
  ]);

  const players = playersResult.status === 'fulfilled' ? playersResult.value : [];
  const items = itemsResult.status === 'fulfilled' ? itemsResult.value : [];
  const updates = updatesResult.status === 'fulfilled' ? updatesResult.value : [];

  const results = [...players, ...items, ...updates];

  return {
    query,
    results,
    sections: {
      players,
      items,
      updates,
    },
    counts: {
      players: players.length,
      items: items.length,
      updates: updates.length,
      total: results.length,
    },
  };
}