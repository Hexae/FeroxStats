import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase-service';
import { createClient as createServerClient } from '@/lib/supabase-server';
import { SKILL_NAMES, isValidSkill } from '@/lib/api-utils';

type Params = { params: Promise<{ slug: string }> };

// GET /api/groups/[slug]/competitions
export async function GET(request: NextRequest, { params }: Params) {
  const { slug } = await params;
  const supabase = serviceClient();

  const { data: group } = await supabase.from('groups').select('id').eq('slug', slug).single();
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

  const status = new URL(request.url).searchParams.get('status'); // active, upcoming, ended
  let query = supabase
    .from('group_competitions')
    .select('*')
    .eq('group_id', group.id)
    .order('starts_at', { ascending: false });

  const now = new Date().toISOString();
  if (status === 'active') {
    query = query.lte('starts_at', now).gte('ends_at', now);
  } else if (status === 'upcoming') {
    query = query.gt('starts_at', now);
  } else if (status === 'ended') {
    query = query.lt('ends_at', now);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/groups/[slug]/competitions  { name, metric, starts_at, ends_at }
export async function POST(request: NextRequest, { params }: Params) {
  const { slug } = await params;
  const authClient = await createServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const supabase = serviceClient();

  const { data: group } = await supabase.from('groups').select('id').eq('slug', slug).single();
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

  // Verify caller is owner or admin
  const { data: callerPlayer } = await supabase
    .from('players').select('username').eq('claimed_by', user.id).single();
  if (!callerPlayer) return NextResponse.json({ error: 'No claimed player' }, { status: 403 });

  const { data: callerMember } = await supabase
    .from('group_members').select('role').eq('group_id', group.id).eq('username', callerPlayer.username).single();
  if (!callerMember || callerMember.role === 'member') {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await request.json() as { name?: string; metric?: string; starts_at?: string; ends_at?: string };
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  if (!body.starts_at || !body.ends_at) return NextResponse.json({ error: 'Start and end dates required' }, { status: 400 });

  const startsAt = new Date(body.starts_at);
  const endsAt = new Date(body.ends_at);
  if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime())) {
    return NextResponse.json({ error: 'Invalid dates' }, { status: 400 });
  }
  if (endsAt <= startsAt) return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 });
  if (startsAt.getTime() < Date.now()) return NextResponse.json({ error: 'Start date must be in the future' }, { status: 400 });

  const metric = isValidSkill(body.metric ?? '') ? body.metric! : 'overall';

  const { data: comp, error: compErr } = await supabase
    .from('group_competitions')
    .insert({
      group_id: group.id,
      name: body.name.trim(),
      metric,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      created_by: user.id,
    })
    .select()
    .single();

  if (compErr) return NextResponse.json({ error: compErr.message }, { status: 500 });

  // Log event
  await supabase.from('group_events').insert({
    group_id: group.id,
    event_type: 'competition_created',
    actor: callerPlayer.username,
    metadata: { competition_name: body.name.trim(), metric },
  });

  return NextResponse.json(comp, { status: 201 });
}
