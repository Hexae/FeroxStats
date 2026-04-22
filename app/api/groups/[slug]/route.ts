import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase-service';
import { createClient as createServerClient } from '@/lib/supabase-server';
import type { Database } from '@/lib/database.types';

type GroupUpdate = Database['public']['Tables']['groups']['Update'];

type Params = { params: Promise<{ slug: string }> };

async function getGroupBySlug(slug: string) {
  const supabase = serviceClient();
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('slug', slug)
    .single();
  if (error || !data) return null;
  return data;
}

async function getCallerUsername(userId: string): Promise<string | null> {
  const { data } = await serviceClient()
    .from('players')
    .select('username')
    .eq('claimed_by', userId)
    .single();
  return data?.username ?? null;
}

async function getCallerRole(groupId: string, username: string): Promise<'owner' | 'admin' | 'member' | null> {
  const { data } = await serviceClient()
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('username', username)
    .single();
  return (data?.role as 'owner' | 'admin' | 'member') ?? null;
}

// GET /api/groups/[slug]
export async function GET(_req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const group = await getGroupBySlug(slug);
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

  const supabase = serviceClient();
  const { data: members, error: membersErr } = await supabase
    .from('group_members')
    .select('*')
    .eq('group_id', group.id)
    .order('joined_at', { ascending: true });

  if (membersErr) return NextResponse.json({ error: membersErr.message }, { status: 500 });

  // Enrich with player data
  const usernames = (members ?? []).map(m => m.username);
  let playerMap: Record<string, { display_name: string; total_level: number; total_xp: number; overall_rank: number | null; last_fetched_at: string | null }> = {};
  if (usernames.length > 0) {
    const { data: players } = await supabase
      .from('players')
      .select('username, display_name, total_level, total_xp, overall_rank, last_fetched_at')
      .in('username', usernames);
    for (const p of players ?? []) {
      playerMap[p.username] = {
        display_name: p.display_name,
        total_level: p.total_level,
        total_xp: p.total_xp,
        overall_rank: p.overall_rank,
        last_fetched_at: p.last_fetched_at ?? null,
      };
    }
  }

  const enrichedMembers = (members ?? []).map(m => ({
    ...m,
    ...(playerMap[m.username] ?? { display_name: m.username, total_level: 0, total_xp: 0, overall_rank: null }),
  }));

  return NextResponse.json({ ...group, members: enrichedMembers });
}

// PATCH /api/groups/[slug]  { name?, description?, is_private? }
export async function PATCH(request: NextRequest, { params }: Params) {
  const { slug } = await params;
  const authClient = await createServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const group = await getGroupBySlug(slug);
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

  const callerUsername = await getCallerUsername(user.id);
  if (!callerUsername) return NextResponse.json({ error: 'No claimed player found' }, { status: 403 });

  const role = await getCallerRole(group.id, callerUsername);
  if (!role || role === 'member') return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });

  const body = await request.json() as {
    name?: string;
    description?: string;
    is_private?: boolean;
    discord_webhook_url?: string | null;
    banner_url?: string | null;
    rank_titles?: (string | null)[] | null;
    rank_icons?: (string | null)[] | null;
  };
  const updates: GroupUpdate = {};
  if (typeof body.name === 'string') {
    const trimmed = body.name.trim();
    if (trimmed.length < 2 || trimmed.length > 60) {
      return NextResponse.json({ error: 'Name must be 2–60 characters' }, { status: 400 });
    }
    updates.name = trimmed;
  }
  if (typeof body.description === 'string') updates.description = body.description;
  if (typeof body.is_private === 'boolean') updates.is_private = body.is_private;
  if ('rank_titles' in body) {
    if (role !== 'owner') {
      return NextResponse.json({ error: 'Only the group owner can set rank titles' }, { status: 403 });
    }
    const titles = body.rank_titles;
    if (titles !== null && titles !== undefined) {
      if (!Array.isArray(titles) || titles.length !== 27) {
        return NextResponse.json({ error: 'rank_titles must be an array of 27 strings' }, { status: 400 });
      }
      // Slots 0 (Owner) and 1 (Deputy Owner) and 11 (Administrator) are fixed
      const sanitized = titles.map((t, i) => {
        if (i === 0) return 'Owner';
        if (i === 1) return 'Deputy Owner';
        if (i === 11) return 'Administrator';
        const str = typeof t === 'string' ? t.trim() : '';
        if (str.length > 50) return str.slice(0, 50);
        return str || null;
      });
      updates.rank_titles = sanitized;
    } else {
      updates.rank_titles = null;
    }
  }
  if ('rank_icons' in body) {
    if (role !== 'owner') {
      return NextResponse.json({ error: 'Only the group owner can set rank icons' }, { status: 403 });
    }
    const icons = body.rank_icons;
    if (icons !== null && icons !== undefined) {
      if (!Array.isArray(icons) || icons.length !== 27) {
        return NextResponse.json({ error: 'rank_icons must be an array of 27 entries' }, { status: 400 });
      }
      updates.rank_icons = icons.map(v => (typeof v === 'string' && v.length > 0 ? v : null));
    } else {
      updates.rank_icons = null;
    }
  }
  if ('banner_url' in body) {
    if (role !== 'owner') {
      return NextResponse.json({ error: 'Only the group owner can set the banner' }, { status: 403 });
    }
    const bannerUrl = body.banner_url;
    if (bannerUrl !== null && typeof bannerUrl === 'string') {
      try {
        const parsed = new URL(bannerUrl);
        if (parsed.protocol !== 'https:') throw new Error();
      } catch {
        return NextResponse.json({ error: 'Banner URL must be a valid https:// URL' }, { status: 400 });
      }
    }
    updates.banner_url = bannerUrl ?? null;
  }
  if ('discord_webhook_url' in body) {
    // Only the owner may set/clear the Discord webhook URL
    if (role !== 'owner') {
      return NextResponse.json({ error: 'Only the group owner can set the Discord webhook' }, { status: 403 });
    }
    const webhookUrl = body.discord_webhook_url;
    if (webhookUrl !== null && typeof webhookUrl === 'string') {
      if (!webhookUrl.startsWith('https://discord.com/api/webhooks/') &&
          !webhookUrl.startsWith('https://discordapp.com/api/webhooks/')) {
        return NextResponse.json({ error: 'Invalid Discord webhook URL' }, { status: 400 });
      }
    }
    updates.discord_webhook_url = webhookUrl ?? null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await serviceClient()
    .from('groups')
    .update(updates)
    .eq('id', group.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/groups/[slug]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const authClient = await createServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const group = await getGroupBySlug(slug);
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

  const callerUsername = await getCallerUsername(user.id);
  if (!callerUsername) return NextResponse.json({ error: 'No claimed player found' }, { status: 403 });

  const role = await getCallerRole(group.id, callerUsername);
  if (role !== 'owner') return NextResponse.json({ error: 'Only the group owner can delete this group' }, { status: 403 });

  const { error } = await serviceClient().from('groups').delete().eq('id', group.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
