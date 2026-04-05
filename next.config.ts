import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@mediapipe/selfie_segmentation': false,
    };
    return config;
  },
  turbopack: {},
};

export default nextConfig;
