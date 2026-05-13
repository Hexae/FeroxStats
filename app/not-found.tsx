import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: '404 – Page Not Found' };

export default function NotFound() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">
      <Image
        src="/death.webp"
        alt="Death"
        width={200}
        height={414}
        className="mb-6 drop-shadow-2xl"
        style={{ height: 'auto' }}
        priority
      />
      <p className="text-[7rem] font-black leading-none text-white mb-2">404</p>
      <p className="text-slate-400 text-lg mb-8">You have died. This page could not be found.</p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-semibold px-5 py-2.5 rounded-lg transition-all shadow-lg shadow-emerald-900/30 text-sm"
      >
        ← Back to home
      </Link>
    </div>
  );
}
