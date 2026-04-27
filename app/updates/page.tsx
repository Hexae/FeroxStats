import UpdatesClient from '@/components/UpdatesClient';
import { Metadata } from 'next';
import { getAllPublishedUpdates } from '@/lib/updates-service';

export const metadata: Metadata = {
  title: 'Recent Updates - FeroxStats',
  description: 'Follow the latest changes to FeroxStats, tracker updates, and player progression highlights.',
};

export default async function UpdatesPage() {
  const updates = await getAllPublishedUpdates();
  return <UpdatesClient updates={updates} />;
}
