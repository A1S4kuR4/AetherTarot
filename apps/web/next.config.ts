import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  output: "standalone",
  images: {
    minimumCacheTTL: 60 * 60 * 24 * 7,
    qualities: [50, 75, 80],
  },
  transpilePackages: [
    "@aethertarot/shared-types",
    "@aethertarot/domain-tarot",
    "@aethertarot/prompting",
  ],
};

export default nextConfig;
