import type { Metadata } from 'next';
import LeaderboardClient from './LeaderboardClient';

export const metadata: Metadata = { title: 'Leaderboards' };

export default function LeaderboardPage() {
  return <LeaderboardClient />;
}
