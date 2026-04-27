import { NextRequest, NextResponse } from 'next/server';
import { getAllPublishedUpdates } from '@/lib/updates-service';

export async function GET(request: NextRequest) {
  const rawLimit = Number(request.nextUrl.searchParams.get('limit') ?? '20');
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 50) : 20;

  const updates = await getAllPublishedUpdates();
  const items = updates.slice(0, limit).map((update) => ({
    id: update.id,
    slug: update.slug,
    title: update.title,
    summary: update.summary,
    category: update.category,
    date: update.date,
    publishedAtISO: update.publishedAtISO,
    image: update.image,
    url: `/updates/${update.slug}`,
  }));

  return NextResponse.json({ updates: items });
}
