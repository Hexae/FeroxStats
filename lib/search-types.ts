export type SearchResultType = 'player' | 'item' | 'update';

type SearchResultBase = {
  id: string;
  type: SearchResultType;
  label: string;
  subtitle?: string;
  href: string;
};

export type PlayerSearchResult = SearchResultBase & {
  type: 'player';
  username: string;
  displayName: string;
  overallRank: number | null;
};

export type ItemSearchResult = SearchResultBase & {
  type: 'item';
  itemName: string;
  itemId: number | null;
  lastTradedAt: string | null;
};

export type UpdateSearchResult = SearchResultBase & {
  type: 'update';
  slug: string;
  category: string;
  publishedAtISO: string;
};

export type UnifiedSearchResult =
  | PlayerSearchResult
  | ItemSearchResult
  | UpdateSearchResult;

export type UnifiedSearchResponse = {
  query: string;
  results: UnifiedSearchResult[];
  sections: {
    players: PlayerSearchResult[];
    items: ItemSearchResult[];
    updates: UpdateSearchResult[];
  };
  counts: {
    players: number;
    items: number;
    updates: number;
    total: number;
  };
};

export function createEmptyUnifiedSearchResponse(query: string): UnifiedSearchResponse {
  return {
    query,
    results: [],
    sections: {
      players: [],
      items: [],
      updates: [],
    },
    counts: {
      players: 0,
      items: 0,
      updates: 0,
      total: 0,
    },
  };
}