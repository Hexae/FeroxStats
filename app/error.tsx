'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function ErrorPage({
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
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">
      <Image
        src="/death.webp"
        alt="Death"
        width={200}
        height={280}
        className="mb-6 drop-shadow-2xl"
        priority
      />
      <p className="text-[7rem] font-black leading-none text-white mb-2">500</p>
      <p className="text-slate-400 text-lg mb-8">Something went wrong. Please try again.</p>
      <div className="flex items-center gap-3">
        <button
          onClick={unstable_retry}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-semibold px-5 py-2.5 rounded-lg transition-all shadow-lg shadow-emerald-900/30 text-sm"
        >
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white font-semibold px-5 py-2.5 rounded-lg transition-all text-sm"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
