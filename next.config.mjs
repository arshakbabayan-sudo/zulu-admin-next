/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
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

export default nextConfig;
