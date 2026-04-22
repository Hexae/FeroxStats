import type { Metadata } from 'next';
import CompetitionsClient from './CompetitionsClient';

export const metadata: Metadata = {
  title: 'Competitions | FeroxStats',
  description: 'All active and upcoming group competitions on FeroxStats.',
};

export default function CompetitionsPage() {
  return <CompetitionsClient />;
}
