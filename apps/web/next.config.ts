import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@aethertarot/shared-types",
    "@aethertarot/domain-tarot",
    "@aethertarot/prompting",
  ],
};

export default nextConfig;
