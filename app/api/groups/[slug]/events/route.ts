import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase-service';

type Params = { params: Promise<{ slug: string }> };

// GET /api/groups/[slug]/events?limit=30
export async function GET(request: NextRequest, { params }: Params) {
  const { slug } = await params;
  const limit = Math.min(parseInt(new URL(request.url).searchParams.get('limit') ?? '30', 10), 100);
  const supabase = serviceClient();

  const { data: group } = await supabase.from('groups').select('id').eq('slug', slug).single();
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

  const { data, error } = await supabase
    .from('group_events')
    .select('*')
    .eq('group_id', group.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
