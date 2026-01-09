import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Enable experimental features if needed
  experimental: {
    // typedRoutes: true,
  },
};

export default nextConfig;
