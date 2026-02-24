import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@hudson/sdk"],
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return [
      { source: "/llms.txt", destination: "/api/llms-txt" },
      { source: "/llms-full.txt", destination: "/api/llms-full-txt" },
    ];
  },
};

export default nextConfig;
