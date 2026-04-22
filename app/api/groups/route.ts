import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase-service';
import { createClient as createServerClient } from '@/lib/supabase-server';

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

// GET /api/groups?q=&limit=20&offset=0
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') ?? '';
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  const supabase = serviceClient();
  let query = supabase
    .from('groups')
    .select('id, name, slug, description, created_at, is_private, created_by')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (q) {
    query = query.ilike('name', `%${q}%`);
  }

  const { data: groups, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch member counts
  const ids = (groups ?? []).map(g => g.id);
  if (ids.length === 0) return NextResponse.json([]);

  const { data: counts } = await supabase
    .from('group_members')
    .select('group_id')
    .in('group_id', ids);

  const countMap: Record<string, number> = {};
  for (const row of counts ?? []) {
    countMap[row.group_id] = (countMap[row.group_id] ?? 0) + 1;
  }

  const result = (groups ?? []).map(g => ({
    ...g,
    member_count: countMap[g.id] ?? 0,
  }));

  return NextResponse.json(result);
}

// POST /api/groups  { name, description?, is_private? }
export async function POST(request: NextRequest) {
  const authClient = await createServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await request.json() as { name?: string; description?: string; is_private?: boolean };
  const { name, description = '', is_private = false } = body;

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return NextResponse.json({ error: 'Group name must be at least 2 characters' }, { status: 400 });
  }
  if (name.trim().length > 60) {
    return NextResponse.json({ error: 'Group name must be 60 characters or fewer' }, { status: 400 });
  }

  const supabase = serviceClient();

  // Check user has a claimed player
  const { data: claimedPlayer } = await supabase
    .from('players')
    .select('username')
    .eq('claimed_by', user.id)
    .single();

  if (!claimedPlayer) {
    return NextResponse.json(
      { error: 'You must claim a player profile before creating a group.' },
      { status: 400 }
    );
  }

  // Generate unique slug
  let slug = generateSlug(name.trim());
  if (!slug) slug = 'group';

  const { data: existing } = await supabase
    .from('groups')
    .select('slug')
    .eq('slug', slug)
    .single();

  if (existing) {
    // Append timestamp suffix to make unique
    slug = `${slug.slice(0, 44)}-${Date.now().toString(36)}`;
  }

  // Create the group
  const { data: group, error: createErr } = await supabase
    .from('groups')
    .insert({ name: name.trim(), slug, description, created_by: user.id, is_private })
    .select()
    .single();

  if (createErr || !group) {
    return NextResponse.json({ error: createErr?.message ?? 'Failed to create group' }, { status: 500 });
  }

  // Add creator as owner
  const { error: memberErr } = await supabase
    .from('group_members')
    .insert({ group_id: group.id, username: claimedPlayer.username, role: 'owner' });

  if (memberErr) {
    // Rollback group
    await supabase.from('groups').delete().eq('id', group.id);
    return NextResponse.json({ error: 'Failed to add owner member' }, { status: 500 });
  }

  return NextResponse.json({ ...group, member_count: 1 }, { status: 201 });
}
