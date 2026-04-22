'use client';

import Link from 'next/link';

export default function Sidebar() {
  return (
    <nav className="sticky top-16 h-[calc(100vh-4rem)] w-64 hidden lg:flex flex-col overflow-y-auto border-r border-[hsl(220_23%_20%)] bg-[hsl(220_23%_11%)] shadow-lg">
      <ul className="flex flex-col">
        <li>
          <a
            href="https://ferox.ps"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-5 py-4 text-sm font-medium text-[hsl(220_20%_64%)] hover:text-white hover:bg-[hsl(220_23%_15%)] transition-colors"
          >
            <svg className="w-5 h-5 text-[hsl(220_23%_43%)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
            </svg>
            Ferox.ps
          </a>
        </li>
      </ul>
    </nav>
  );
}
