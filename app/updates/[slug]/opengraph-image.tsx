import { ImageResponse } from 'next/og';
import { getPublishedUpdateBySlug } from '@/lib/updates-service';

export const alt = 'FeroxStats Update';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const update = await getPublishedUpdateBySlug(slug);

  if (!update) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            background: 'linear-gradient(135deg, #0f172a 0%, #111827 100%)',
            color: '#ffffff',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 52,
            fontWeight: 800,
          }}
        >
          FeroxStats Updates
        </div>
      ),
      size,
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px',
          background: 'radial-gradient(circle at 85% 15%, rgba(16,185,129,0.25), transparent 40%), linear-gradient(135deg, #0f172a 0%, #111827 100%)',
          color: '#ffffff',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: 24,
            color: '#6ee7b7',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}
        >
          {update.category}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: 58, fontWeight: 900, lineHeight: 1.08, maxWidth: '95%' }}>{update.title}</div>
          <div style={{ fontSize: 30, color: '#cbd5e1' }}>{update.date}</div>
        </div>

        <div style={{ fontSize: 30, color: '#34d399', fontWeight: 700 }}>feroxstats.com</div>
      </div>
    ),
    size,
  );
}
