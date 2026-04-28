import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase-server';
import AccountClient from './AccountClient';

export const metadata: Metadata = { title: 'My Account' };

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  await supabase
    .from('user_profiles')
    .upsert({ id: user.id, email: user.email ?? null }, { onConflict: 'id' });

  // Fetch claimed player (if any)
  const { data: player } = await supabase
    .from('players')
    .select('username, display_name, game_mode, total_level, total_xp, overall_rank, claimed_at, country, cover_screenshot_id')
    .eq('claimed_by', user.id)
    .single();

  // Fetch account profile
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_admin, timezone, locale, default_search_mode, prefers_compact_numbers, notify_milestones, notify_competitions, notify_updates, notify_email, notify_discord, mfa_enabled, last_reauth_at, last_unclaim_at')
    .eq('id', user.id)
    .single();

  return (
    <AccountClient
      user={{ id: user.id, email: user.email ?? '' }}
      claimedPlayer={player ?? null}
      isAdmin={profile?.is_admin ?? false}
      profile={profile ?? null}
    />
  );
}
