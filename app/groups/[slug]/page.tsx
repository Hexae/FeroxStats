import { notFound } from 'next/navigation';
import GroupPageClient from './GroupPageClient';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  return {
    title: `${slug} | Groups | FeroxStats`,
  };
}

export default async function GroupPage({ params }: Props) {
  const { slug } = await params;
  if (!slug) notFound();
  return <GroupPageClient slug={slug} />;
}
