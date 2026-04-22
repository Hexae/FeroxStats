import type { Metadata } from 'next';
import GEClient from './GEClient';

export const metadata: Metadata = {
  title: 'Grand Exchange — FeroxStats',
  description: 'Live Grand Exchange tracker for Ferox.ps — recent trades and open offers.',
};

export default function GEPage() {
  return <GEClient />;
}
