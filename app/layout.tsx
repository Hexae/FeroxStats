import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ConditionalShell from "@/components/ConditionalShell";
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "FeroxStats", template: "%s | FeroxStats" },
  description: "Player stats, hiscores, and analytics for Ferox.ps.",
  openGraph: {
    type: "website",
    siteName: "FeroxStats",
    title: "FeroxStats",
    description: "Player stats, hiscores, and analytics for Ferox.ps",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full font-[var(--font-inter)]">
        <div className="relative flex flex-col min-h-screen">
          <ConditionalShell>
            {children}
          </ConditionalShell>
        </div>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

