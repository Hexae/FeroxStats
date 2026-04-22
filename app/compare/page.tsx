import type { Metadata } from 'next';
import CompareClient from './CompareClient';

export const metadata: Metadata = { title: 'Compare Players' };

export default function ComparePage() {
  return <CompareClient />;
}
