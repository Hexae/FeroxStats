import type { Metadata } from 'next';
import TopGainsClient from './TopGainsClient';

export const metadata: Metadata = { title: 'Top Gains' };

export default function TopGainsPage() {
  return <TopGainsClient />;
}
