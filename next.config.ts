import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
  // pdf.js is loaded from node_modules at runtime on the server (text
  // extraction for search inside library files), not bundled.
  serverExternalPackages: ["pdfjs-dist"],
  turbopack: {
    root: __dirname,
  },
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
      { protocol: "https", hostname: "*.srvstatic.kz" },
    ],
  },
  compiler: {
    // Was `true`, which strips EVERY console.* call from the production
    // bundle — including every console.error() this codebase relies on for
    // Railway logs. That's why "no logs" for the pdf-to-test crash: it was
    // never a logging gap in the route code, the compiler deleted all of it.
    removeConsole: false,
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