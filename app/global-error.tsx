'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0f0e17', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center', padding: '2rem' }}>
        <p style={{ fontSize: '6rem', fontWeight: 900, color: '#fff', lineHeight: 1, margin: '0 0 0.5rem' }}>500</p>
        <p style={{ color: '#94a3b8', fontSize: '1.125rem', margin: '0 0 2rem' }}>A critical error occurred. Please refresh the page.</p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={unstable_retry}
            style={{ background: 'linear-gradient(to right, #059669, #047857)', color: '#fff', fontWeight: 600, padding: '0.625rem 1.25rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
          >
            Try again
          </button>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- global-error replaces the root layout, Next.js Link context is unavailable */}
          <a
            href="/"
            style={{ background: 'transparent', color: '#cbd5e1', fontWeight: 600, padding: '0.625rem 1.25rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.1)', textDecoration: 'none', fontSize: '0.875rem' }}
          >
            Back to home
          </a>
        </div>
      </body>
    </html>
  );
}
