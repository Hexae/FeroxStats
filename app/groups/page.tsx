import GroupsClient from './GroupsClient';

export const metadata = {
  title: 'Groups | FeroxStats',
  description: 'Create and join clans — view aggregate gains and group leaderboards.',
};

export default function GroupsPage() {
  return <GroupsClient />;
}
