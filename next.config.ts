import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Output standalone build for Docker production deployment
  output: "standalone",
  // Enable experimental features if needed
  experimental: {
    // typedRoutes: true,
  },
};

export default nextConfig;
