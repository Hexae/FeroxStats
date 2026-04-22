import { Metadata } from 'next';
import ItemPageClient from './ItemPageClient';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const name = decodeURIComponent(slug);
  return {
    title: `${name} – G.E. History | FeroxStats`,
    description: `Price history and recent trades for ${name} on the Ferox.ps Grand Exchange.`,
  };
}

export default async function ItemPage({ params }: Props) {
  const { slug } = await params;
  return <ItemPageClient name={decodeURIComponent(slug)} />;
}
