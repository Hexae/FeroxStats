import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/admin-auth';

type UpdatePayload = {
  id?: number;
  slug?: string;
  title?: string;
  summary?: string;
  category?: string;
  image?: string;
  markdown?: string;
  publishedAtISO?: string;
  isPublished?: boolean;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export async function GET() {
  const { supabase, error: authError } = await getAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: authError }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('game_updates')
    .select('id, slug, title, summary, category, image, markdown, published_at, is_published, created_at, updated_at')
    .order('published_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ updates: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { supabase, error: authError } = await getAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: authError }, { status: 403 });
  }

  const payload = (await request.json()) as UpdatePayload;
  if (!payload.title || !payload.markdown) {
    return NextResponse.json({ error: 'Missing title or markdown' }, { status: 400 });
  }

  const slug = payload.slug?.trim() || slugify(payload.title);
  const publishedAt = payload.publishedAtISO?.trim() || new Date().toISOString();

  const { data, error } = await supabase
    .from('game_updates')
    .insert({
      slug,
      title: payload.title.trim(),
      summary: payload.summary?.trim() || null,
      category: payload.category?.trim() || 'Game Update',
      image: payload.image?.trim() || '/snapshot.png',
      markdown: payload.markdown,
      published_at: publishedAt,
      is_published: payload.isPublished ?? true,
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id });
}

export async function PUT(request: NextRequest) {
  const { supabase, error: authError } = await getAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: authError }, { status: 403 });
  }

  const payload = (await request.json()) as UpdatePayload;
  if (!payload.id || !payload.title || !payload.markdown) {
    return NextResponse.json({ error: 'Missing id, title or markdown' }, { status: 400 });
  }

  const slug = payload.slug?.trim() || slugify(payload.title);
  const publishedAt = payload.publishedAtISO?.trim() || new Date().toISOString();

  const { error } = await supabase
    .from('game_updates')
    .update({
      slug,
      title: payload.title.trim(),
      summary: payload.summary?.trim() || null,
      category: payload.category?.trim() || 'Game Update',
      image: payload.image?.trim() || '/snapshot.png',
      markdown: payload.markdown,
      published_at: publishedAt,
      is_published: payload.isPublished ?? true,
    })
    .eq('id', payload.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const { supabase, error: authError } = await getAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: authError }, { status: 403 });
  }

  const payload = (await request.json()) as UpdatePayload;
  if (!payload.id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const { error } = await supabase.from('game_updates').delete().eq('id', payload.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
