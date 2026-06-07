import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.pravatar.cc" },
      { protocol: "https", hostname: "goodworker.com" },
      { protocol: "https", hostname: "goodworker.by" },
      { protocol: "https", hostname: "goodworker.ru" },
      { protocol: "https", hostname: "www.goodworker.com" },
      { protocol: "https", hostname: "www.goodworker.by" },
      { protocol: "https", hostname: "www.goodworker.ru" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  experimental: {
    serverActions: {
      allowedOrigins: [appUrl.replace(/^https?:\/\//, "")],
      bodySizeLimit: '10mb',
    },
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...config.externals, "prisma", "@prisma/client"];
    }
    return config;
  },
};

const withNextIntl = createNextIntlPlugin("./src/shared/i18n/request.ts");

export default withNextIntl(nextConfig);