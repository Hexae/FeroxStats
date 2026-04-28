import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { serviceClient } from '@/lib/supabase-service';
import {
  DEFAULT_ACCOUNT_PREFERENCES,
  type AccountPreferencePayload,
  type SearchModePreference,
} from '@/lib/account-preferences';

type PreferencesRow = {
  timezone: string | null;
  locale: string | null;
  default_search_mode: SearchModePreference | null;
  prefers_compact_numbers: boolean | null;
  notify_milestones: boolean | null;
  notify_competitions: boolean | null;
  notify_updates: boolean | null;
  notify_email: boolean | null;
  notify_discord: boolean | null;
  mfa_enabled: boolean | null;
};

const VALID_SEARCH_MODES = new Set<SearchModePreference>(['smart', 'full']);

function toResponsePayload(row: PreferencesRow | null): AccountPreferencePayload {
  return {
    timezone: row?.timezone?.trim() || DEFAULT_ACCOUNT_PREFERENCES.timezone,
    locale: row?.locale?.trim() || DEFAULT_ACCOUNT_PREFERENCES.locale,
    default_search_mode: row?.default_search_mode && VALID_SEARCH_MODES.has(row.default_search_mode)
      ? row.default_search_mode
      : DEFAULT_ACCOUNT_PREFERENCES.default_search_mode,
    prefers_compact_numbers: row?.prefers_compact_numbers ?? DEFAULT_ACCOUNT_PREFERENCES.prefers_compact_numbers,
    notify_milestones: row?.notify_milestones ?? DEFAULT_ACCOUNT_PREFERENCES.notify_milestones,
    notify_competitions: row?.notify_competitions ?? DEFAULT_ACCOUNT_PREFERENCES.notify_competitions,
    notify_updates: row?.notify_updates ?? DEFAULT_ACCOUNT_PREFERENCES.notify_updates,
    notify_email: row?.notify_email ?? DEFAULT_ACCOUNT_PREFERENCES.notify_email,
    notify_discord: row?.notify_discord ?? DEFAULT_ACCOUNT_PREFERENCES.notify_discord,
    mfa_enabled: row?.mfa_enabled ?? DEFAULT_ACCOUNT_PREFERENCES.mfa_enabled,
  };
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const db = serviceClient();
  await db.from('user_profiles').upsert(
    { id: user.id, email: user.email ?? null },
    { onConflict: 'id' },
  );

  const { data: profile } = await db
    .from('user_profiles')
    .select('timezone, locale, default_search_mode, prefers_compact_numbers, notify_milestones, notify_competitions, notify_updates, notify_email, notify_discord, mfa_enabled')
    .eq('id', user.id)
    .single();

  return NextResponse.json({ preferences: toResponsePayload(profile as PreferencesRow | null) });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = (await request.json()) as Partial<AccountPreferencePayload>;
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.timezone !== undefined) {
    if (typeof body.timezone !== 'string' || body.timezone.length > 100) {
      return NextResponse.json({ error: 'Invalid timezone' }, { status: 400 });
    }
    updates.timezone = body.timezone.trim() || DEFAULT_ACCOUNT_PREFERENCES.timezone;
  }

  if (body.locale !== undefined) {
    if (typeof body.locale !== 'string' || body.locale.length > 40) {
      return NextResponse.json({ error: 'Invalid locale' }, { status: 400 });
    }
    updates.locale = body.locale.trim() || DEFAULT_ACCOUNT_PREFERENCES.locale;
  }

  if (body.default_search_mode !== undefined) {
    if (!VALID_SEARCH_MODES.has(body.default_search_mode)) {
      return NextResponse.json({ error: 'Invalid search mode' }, { status: 400 });
    }
    updates.default_search_mode = body.default_search_mode;
  }

  const boolFields: Array<keyof AccountPreferencePayload> = [
    'prefers_compact_numbers',
    'notify_milestones',
    'notify_competitions',
    'notify_updates',
    'notify_email',
    'notify_discord',
    'mfa_enabled',
  ];

  for (const key of boolFields) {
    if (body[key] !== undefined) {
      if (typeof body[key] !== 'boolean') {
        return NextResponse.json({ error: `Invalid ${key}` }, { status: 400 });
      }
      updates[key] = body[key];
    }
  }

  const db = serviceClient();
  const { error } = await db
    .from('user_profiles')
    .upsert({ id: user.id, email: user.email ?? null, ...updates }, { onConflict: 'id' });

  if (error) {
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
  }

  const { data: refreshed } = await db
    .from('user_profiles')
    .select('timezone, locale, default_search_mode, prefers_compact_numbers, notify_milestones, notify_competitions, notify_updates, notify_email, notify_discord, mfa_enabled')
    .eq('id', user.id)
    .single();

  return NextResponse.json({ success: true, preferences: toResponsePayload(refreshed as PreferencesRow | null) });
}
