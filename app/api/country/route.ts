import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { COUNTRIES } from '@/lib/osrs';

const VALID_CODES = new Set(COUNTRIES.map(c => c.code));

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json() as { country?: string | null };
  const { country } = body;

  // Allow null/empty to clear the country
  if (country !== null && country !== undefined && country !== '') {
    if (typeof country !== 'string' || !VALID_CODES.has(country.toUpperCase())) {
      return NextResponse.json({ error: 'Invalid country code' }, { status: 400 });
    }
  }

  const { error } = await supabase
    .from('players')
    .update({ country: country || null })
    .eq('claimed_by', user.id);

  if (error) {
    return NextResponse.json({ error: 'Failed to update country.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
