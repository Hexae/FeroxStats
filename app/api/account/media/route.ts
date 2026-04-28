import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { serviceClient } from '@/lib/supabase-service';

async function getClaimedPlayerUsername(userId: string) {
  const db = serviceClient();
  const { data } = await db
    .from('players')
    .select('username, cover_screenshot_id')
    .eq('claimed_by', userId)
    .single();

  return data;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const player = await getClaimedPlayerUsername(user.id);
  if (!player) {
    return NextResponse.json({ playerUsername: null, coverScreenshotId: null, screenshots: [] });
  }

  const db = serviceClient();
  const { data: screenshots } = await db
    .from('player_screenshots')
    .select('id, public_url, created_at, sort_order')
    .eq('player_username', player.username)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  return NextResponse.json({
    playerUsername: player.username,
    coverScreenshotId: player.cover_screenshot_id ?? null,
    screenshots: screenshots ?? [],
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = (await request.json()) as { screenshotId?: string | null };
  const screenshotId = body.screenshotId ?? null;

  const player = await getClaimedPlayerUsername(user.id);
  if (!player) {
    return NextResponse.json({ error: 'No claimed profile found' }, { status: 400 });
  }

  const db = serviceClient();

  if (screenshotId) {
    const { data: screenshot } = await db
      .from('player_screenshots')
      .select('id')
      .eq('id', screenshotId)
      .eq('player_username', player.username)
      .single();

    if (!screenshot) {
      return NextResponse.json({ error: 'Screenshot not found' }, { status: 404 });
    }
  }

  const { error } = await db
    .from('players')
    .update({ cover_screenshot_id: screenshotId })
    .eq('username', player.username);

  if (error) {
    return NextResponse.json({ error: 'Failed to set cover image' }, { status: 500 });
  }

  return NextResponse.json({ success: true, coverScreenshotId: screenshotId });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = (await request.json()) as { orderedIds?: string[] };
  const orderedIds = body.orderedIds ?? [];

  if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== 'string')) {
    return NextResponse.json({ error: 'orderedIds must be an array of IDs' }, { status: 400 });
  }

  const player = await getClaimedPlayerUsername(user.id);
  if (!player) {
    return NextResponse.json({ error: 'No claimed profile found' }, { status: 400 });
  }

  const db = serviceClient();

  const { data: existingRows } = await db
    .from('player_screenshots')
    .select('id')
    .eq('player_username', player.username)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  const existingIds = new Set((existingRows ?? []).map((row) => row.id));
  const incomingIds = new Set(orderedIds);

  if (existingIds.size !== incomingIds.size || [...existingIds].some((id) => !incomingIds.has(id))) {
    return NextResponse.json({ error: 'orderedIds must include every screenshot exactly once' }, { status: 400 });
  }

  for (let index = 0; index < orderedIds.length; index += 1) {
    const id = orderedIds[index];
    const { error } = await db
      .from('player_screenshots')
      .update({ sort_order: index })
      .eq('id', id)
      .eq('player_username', player.username);

    if (error) {
      return NextResponse.json({ error: 'Failed to reorder screenshots' }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
