import Link from 'next/link';
import FooterStatus from './FooterStatus';

const YEAR = new Date().getFullYear();

export default function Footer() {
  return (
    <footer className="border-t border-[hsl(220_23%_20%)] bg-[hsl(220_23%_8%)] mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Main grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="font-bold text-base text-white tracking-tight">
                Ferox<span className="text-blue-400">Stats</span>
              </span>
            </div>
            <p className="text-sm text-[hsl(220_20%_64%)] leading-relaxed max-w-xs">
              Player stats, hiscores, and analytics for Ferox.ps — an Old School RuneScape private server.
            </p>
            <a
              href="https://ferox.ps"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors shadow shadow-blue-900/40"
            >
              Visit Ferox.ps
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
              </svg>
            </a>
          </div>

          {/* Features */}
          <div>
            <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-4">
              Features
            </h4>
            <ul className="space-y-2.5">
              {[
                { href: '/', label: 'Player Lookup' },
                { href: '/hiscores', label: 'Hiscores' },
                { href: '/leaderboard', label: 'Leaderboard' },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm text-[hsl(220_20%_64%)] hover:text-white transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Account */}
          <div>
            <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-4">
              Account
            </h4>
            <ul className="space-y-2.5">
              {[
                { href: '/auth/login', label: 'Sign In' },
                { href: '/auth/register', label: 'Register' },
                { href: '/account', label: 'My Profile' },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm text-[hsl(220_20%_64%)] hover:text-white transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-[hsl(220_23%_20%)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[hsl(220_23%_43%)]">
          <p>© {YEAR} FeroxStats. Not affiliated with Ferox.ps or Jagex Ltd.</p>
          <FooterStatus />
        </div>
      </div>
    </footer>
  );
}