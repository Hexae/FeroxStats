import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/api-utils';
import { createEmptyUnifiedSearchResponse } from '@/lib/search-types';
import { unifiedSearch } from '@/lib/search-service';

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
  const limited = rateLimit(`search:${ip}`, { limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  const mode = request.nextUrl.searchParams.get('mode') === 'full' ? 'full' : 'suggest';

  if (!q || q.length > 100) {
    return NextResponse.json(createEmptyUnifiedSearchResponse(q));
  }

  const response = await unifiedSearch(q, mode === 'full'
    ? { playerLimit: 20, itemLimit: 20, updateLimit: 20 }
    : { playerLimit: 6, itemLimit: 5, updateLimit: 4 });

  return NextResponse.json(response);
}
