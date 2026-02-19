import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["frame-ui"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
