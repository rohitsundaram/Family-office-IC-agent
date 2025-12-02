import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async redirects() {
    return [{ source: "/case/:id", destination: "/cases/:id", permanent: true }];
  },
  async rewrites() {
    return [
      { source: "/api/case", destination: "/api/cases" },
      { source: "/api/case/:id/upload", destination: "/api/cases/:id/upload" },
      { source: "/api/case/:id/analyze", destination: "/api/cases/:id/analyze" },
    ];
  },
};

export default nextConfig;
