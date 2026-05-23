import { withSentryConfig } from "@sentry/nextjs";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // K1 safeguard: never let ESLint or TypeScript errors silently pass
  // through a Vercel build. The Vercel ESLint silent-fail gotcha bit us
  // mid-2026-05 — flipping these to true ships broken code with no
  // visible deploy failure. Keep them false.
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
  async rewrites() {
    const api = process.env.ADMIN_API_ORIGIN ?? "http://127.0.0.1:8008";
    return [
      {
        source: "/api/proxy/:path*",
        destination: `${api.replace(/\/$/, "")}/api/:path*`,
      },
    ];
  },
};

const sentryWebpackPluginOptions = {
  org: "zulu-platform",
  project: "zulu-admin",
  silent: true,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  disableLogger: true,
  hideSourceMaps: true,
  tunnelRoute: "/monitoring",
};

export default withSentryConfig(withBundleAnalyzer(nextConfig), sentryWebpackPluginOptions);
