import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Production images are served either as static assets under /public or
  // directly from the NASA Images CDN — both are plain <img> tags, so the
  // image optimizer stays off (also keeps the OpenNext worker bundle lean).
  images: { unoptimized: true },
};

export default nextConfig;
