import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Metadata (title, description) goes in <head> for every visitor, not streamed into <body>.
  htmlLimitedBots: /.*/,
  images: { formats: ["image/avif", "image/webp"] },
  // Background videos: cache for a day, then revalidate in the background (file names are not hashed).
  async headers() {
    return [{ source: "/video/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }] }];
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default withNextIntl(nextConfig);
