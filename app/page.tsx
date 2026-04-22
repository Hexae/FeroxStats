import HomeClient from '@/components/HomeClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FeroxStats - Player Analytics for Ferox.ps',
};

export default function Home() {
  return <HomeClient />;
}
