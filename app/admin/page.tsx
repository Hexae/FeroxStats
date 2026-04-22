import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase-server';
import AdminClient from './AdminClient';

export const metadata: Metadata = { title: 'Admin' };

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) redirect('/account');

  // Fetch all players with claim info
  const { data: players } = await supabase
    .from('players')
    .select('username, display_name, game_mode, total_level, overall_rank, claimed_by, claimed_at, last_fetched_at')
    .order('overall_rank', { ascending: true });

  // Fetch all user profiles
  const { data: userProfiles } = await supabase
    .from('user_profiles')
    .select('id, email, is_admin, created_at')
    .order('created_at', { ascending: false });

  // Fetch all groups with member count
  const { data: groupsRaw } = await supabase
    .from('groups')
    .select('id, name, slug, discord_verified, created_at, group_members(count)')
    .order('created_at', { ascending: false });

  const groups = (groupsRaw ?? []).map(g => ({
    id: g.id,
    name: g.name,
    slug: g.slug,
    discord_verified: g.discord_verified ?? null,
    created_at: g.created_at,
    members_count: (g.group_members as unknown as { count: number }[])?.[0]?.count ?? 0,
  }));

  return (
    <AdminClient
      players={players ?? []}
      userProfiles={userProfiles ?? []}
      groups={groups}
    />
  );
}
