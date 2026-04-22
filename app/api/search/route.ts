import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase-service';
import { rateLimit } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
  const limited = rateLimit(`search:${ip}`, { limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  const q = request.nextUrl.searchParams.get('q')?.trim().toLowerCase();
  if (!q || q.length < 1 || q.length > 100) {
    return NextResponse.json([]);
  }

  const db = serviceClient();

  const { data } = await db
    .from('players')
    .select('username, display_name')
    .ilike('username', `%${q}%`)
    .order('overall_rank', { ascending: true })
    .limit(8);

  return NextResponse.json(data ?? []);
}
