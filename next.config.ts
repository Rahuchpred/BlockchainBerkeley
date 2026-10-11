import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // The dev cache kept serving stale Lime styles after a restart, so it is off.
    turbopackFileSystemCacheForDev: false,
  },
  images: {
    // Event photos and team art come from Gemini's market data.
    remotePatterns: [
      { protocol: "https", hostname: "assets.gemini.com" },
      { protocol: "https", hostname: "images.ctfassets.net" },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
