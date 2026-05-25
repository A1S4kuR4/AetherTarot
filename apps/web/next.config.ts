import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    qualities: [50, 75, 80],
  },
  transpilePackages: [
    "@aethertarot/shared-types",
    "@aethertarot/domain-tarot",
    "@aethertarot/prompting",
  ],
};

export default nextConfig;
