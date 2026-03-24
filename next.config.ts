import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";


const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.pravatar.cc",
      },
      {
        protocol: "https",
        hostname: "goodworker.com",
      },
      {
        protocol: "https",
        hostname: "goodworker.by",
      },
      {
        protocol: "https",
        hostname: "goodworker.ru",
      },
      {
        protocol: "https",
        hostname: "www.goodworker.com",
      },
      {
        protocol: "https",
        hostname: "www.goodworker.by",
      },
      {
        protocol: "https",
        hostname: "www.goodworker.ru",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

const withNextIntl = createNextIntlPlugin("./src/shared/i18n/request.ts");

export default withNextIntl(nextConfig);