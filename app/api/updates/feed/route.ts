import { getAllPublishedUpdates } from '@/lib/updates-service';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://feroxstats.com';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const updates = await getAllPublishedUpdates();
  const latest = updates.slice(0, 50);

  const items = latest
    .map((update) => {
      const url = `${SITE_URL}/updates/${update.slug}`;
      return [
        '<item>',
        `<title>${escapeXml(update.title)}</title>`,
        `<description>${escapeXml(update.summary)}</description>`,
        `<link>${url}</link>`,
        `<guid isPermaLink="true">${url}</guid>`,
        `<pubDate>${new Date(update.publishedAtISO).toUTCString()}</pubDate>`,
        '</item>',
      ].join('');
    })
    .join('');

  const xml =
    '<?xml version="1.0" encoding="UTF-8" ?>' +
    '<rss version="2.0">' +
    '<channel>' +
    '<title>FeroxStats Updates</title>' +
    '<description>Latest Ferox.ps update notes from FeroxStats.</description>' +
    `<link>${SITE_URL}/updates</link>` +
    items +
    '</channel>' +
    '</rss>';

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
