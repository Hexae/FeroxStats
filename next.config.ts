import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'oldschool.runescape.wiki' },
      { protocol: 'https', hostname: 'ferox.ps' },
    ],
  },
};

export default nextConfig;
