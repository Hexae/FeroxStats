import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase-server';
import AccountClient from './AccountClient';

export const metadata: Metadata = { title: 'My Account' };

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  // Fetch claimed player (if any)
  const { data: player } = await supabase
    .from('players')
    .select('username, display_name, game_mode, total_level, total_xp, overall_rank, claimed_at, country')
    .eq('claimed_by', user.id)
    .single();

  // Fetch admin status
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  return (
    <AccountClient
      user={{ id: user.id, email: user.email ?? '' }}
      claimedPlayer={player ?? null}
      isAdmin={profile?.is_admin ?? false}
    />
  );
}
