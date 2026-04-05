import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
        config.resolve.fallback = {
        ...config.resolve.fallback,
        '@mediapipe/selfie_segmentation': false,
        };
    }
    return config;
  },
};

export default nextConfig;
