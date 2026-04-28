import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { serviceClient } from '@/lib/supabase-service';
import { randomUUID } from 'crypto';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_SCREENSHOTS = 10;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
// Magic-byte signatures to verify file content independently of the declared MIME type
const MAGIC_BYTES: Array<{ mime: string; bytes: number[]; offset?: number }> = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png',  bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF header
  { mime: 'image/gif',  bytes: [0x47, 0x49, 0x46] }, // GIF
];

function detectMagicBytes(buf: Uint8Array): string | null {
  for (const sig of MAGIC_BYTES) {
    const off = sig.offset ?? 0;
    if (sig.bytes.every((b, i) => buf[off + i] === b)) {
      // Extra check for WEBP: bytes 8-11 must be 'WEBP'
      if (sig.mime === 'image/webp') {
        const webp = [0x57, 0x45, 0x42, 0x50];
        if (!webp.every((b, i) => buf[8 + i] === b)) continue;
      }
      return sig.mime;
    }
  }
  return null;
}

async function getAuthenticatedOwner(
  username: string,
): Promise<{ userId: string } | NextResponse> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify the authenticated user actually owns this player profile
  const db = serviceClient();
  const { data: player } = await db
    .from('players')
    .select('claimed_by')
    .eq('username', username.toLowerCase())
    .single();

  if (!player || player.claimed_by !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return { userId: user.id };
}

// POST /api/player/[username]/screenshot — add a screenshot (max 10)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const decoded = decodeURIComponent(username);

  const ownerOrError = await getAuthenticatedOwner(decoded);
  if (ownerOrError instanceof NextResponse) return ownerOrError;

  const db = serviceClient();

  // Enforce 10-screenshot limit
  const { count } = await db
    .from('player_screenshots')
    .select('id', { count: 'exact', head: true })
    .eq('player_username', decoded.toLowerCase());

  if ((count ?? 0) >= MAX_SCREENSHOTS) {
    return NextResponse.json({ error: `Maximum of ${MAX_SCREENSHOTS} screenshots allowed` }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('screenshot');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'Missing screenshot file' }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File exceeds 5 MB limit' }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Only JPEG, PNG, WebP, and GIF images are allowed' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const detectedMime = detectMagicBytes(bytes);
  if (!detectedMime || detectedMime !== file.type) {
    return NextResponse.json({ error: 'File content does not match declared type' }, { status: 400 });
  }

  const extMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png':  'png',
    'image/webp': 'webp',
    'image/gif':  'gif',
  };
  const ext = extMap[detectedMime];
  const fileId = randomUUID();
  const storagePath = `${decoded.toLowerCase()}/${fileId}.${ext}`;

  const { error: uploadError } = await db.storage
    .from('screenshots')
    .upload(storagePath, bytes, { contentType: detectedMime, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }

  const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/screenshots/${storagePath}`;

  const { data: lastRow } = await db
    .from('player_screenshots')
    .select('sort_order')
    .eq('player_username', decoded.toLowerCase())
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSortOrder = Number.isFinite(lastRow?.sort_order)
    ? Number(lastRow?.sort_order) + 1
    : 0;

  const { data: row, error: insertError } = await db.from('player_screenshots')
    .insert({
      player_username: decoded.toLowerCase(),
      storage_path: storagePath,
      public_url: publicUrl,
      sort_order: nextSortOrder,
    })
    .select('id, public_url, created_at')
    .single();

  if (insertError) {
    // Clean up the uploaded file so storage stays consistent
    await db.storage.from('screenshots').remove([storagePath]);
    return NextResponse.json({ error: 'Failed to save screenshot' }, { status: 500 });
  }

  return NextResponse.json(row);
}

// DELETE /api/player/[username]/screenshot?id=<uuid> — remove one screenshot
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const decoded = decodeURIComponent(username);

  const ownerOrError = await getAuthenticatedOwner(decoded);
  if (ownerOrError instanceof NextResponse) return ownerOrError;

  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
  }

  const db = serviceClient();

  // Fetch the row to get the storage path, scoped to this player for safety
  const { data: row, error: fetchError } = await db.from('player_screenshots')
    .select('storage_path')
    .eq('id', id)
    .eq('player_username', decoded.toLowerCase())
    .single();

  if (fetchError || !row) {
    return NextResponse.json({ error: 'Screenshot not found' }, { status: 404 });
  }

  const { error: removeError } = await db.storage
    .from('screenshots')
    .remove([row.storage_path]);

  if (removeError) {
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }

  await db.from('player_screenshots')
    .delete()
    .eq('id', id);

  await db
    .from('players')
    .update({ cover_screenshot_id: null })
    .eq('username', decoded.toLowerCase())
    .eq('cover_screenshot_id', id);

  return NextResponse.json({ ok: true });
}
