import { Metadata } from 'next';
import { createClient } from '@/lib/supabase-server';
import { serviceClient } from '@/lib/supabase-service';
import PlayerPageClient from './PlayerPageClient';

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const decoded = decodeURIComponent(username);
  return {
    title: `${decoded} – Player Stats`,
    description: `View ${decoded}'s skill levels, XP, and hiscore rankings on Ferox.ps`,
  };
}

export default async function PlayerPage({ params }: Props) {
  const { username } = await params;
  const decoded = decodeURIComponent(username);

  // Determine if the current user owns this profile
  let isOwner = false;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const db = serviceClient();
      const { data: player } = await db
        .from('players')
        .select('claimed_by')
        .eq('username', decoded.toLowerCase())
        .single();
      isOwner = player?.claimed_by === user.id;
    }
  } catch { /* non-critical */ }

  return <PlayerPageClient username={decoded} isOwner={isOwner} />;
}
