import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase-service';
import { createClient as createServerClient } from '@/lib/supabase-server';

type Params = { params: Promise<{ slug: string }> };

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

async function getCallerUsername(userId: string): Promise<string | null> {
  const { data } = await serviceClient()
    .from('players')
    .select('username')
    .eq('claimed_by', userId)
    .single();
  return data?.username ?? null;
}

// POST /api/groups/[slug]/banner  (multipart/form-data, field: "file")
export async function POST(request: NextRequest, { params }: Params) {
  const { slug } = await params;

  const authClient = await createServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const supabase = serviceClient();

  const { data: group } = await supabase
    .from('groups')
    .select('id')
    .eq('slug', slug)
    .single();
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

  const callerUsername = await getCallerUsername(user.id);
  if (!callerUsername) return NextResponse.json({ error: 'No claimed player found' }, { status: 403 });

  const { data: membership } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', group.id)
    .eq('username', callerUsername)
    .single();
  if (membership?.role !== 'owner') {
    return NextResponse.json({ error: 'Only the group owner can set the banner' }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'File must be JPEG, PNG, WebP or GIF' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File must be under 5 MB' }, { status: 400 });
  }

  const ext = file.type.split('/')[1].replace('jpeg', 'jpg');
  const storagePath = `${group.id}/banner.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from('group-banners')
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage
    .from('group-banners')
    .getPublicUrl(storagePath);

  // Bust cache by appending a timestamp query param
  const bannerUrl = `${publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabase
    .from('groups')
    .update({ banner_url: bannerUrl })
    .eq('id', group.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ banner_url: bannerUrl });
}

// DELETE /api/groups/[slug]/banner
export async function DELETE(request: NextRequest, { params }: Params) {
  const { slug } = await params;

  const authClient = await createServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const supabase = serviceClient();

  const { data: group } = await supabase
    .from('groups')
    .select('id')
    .eq('slug', slug)
    .single();
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

  const callerUsername = await getCallerUsername(user.id);
  if (!callerUsername) return NextResponse.json({ error: 'No claimed player found' }, { status: 403 });

  const { data: membership } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', group.id)
    .eq('username', callerUsername)
    .single();
  if (membership?.role !== 'owner') {
    return NextResponse.json({ error: 'Only the group owner can remove the banner' }, { status: 403 });
  }

  // Delete all files under this group's banner folder
  const { data: files } = await supabase.storage
    .from('group-banners')
    .list(group.id);

  if (files && files.length > 0) {
    await supabase.storage
      .from('group-banners')
      .remove(files.map(f => `${group.id}/${f.name}`));
  }

  await supabase
    .from('groups')
    .update({ banner_url: null })
    .eq('id', group.id);

  return NextResponse.json({ ok: true });
}
