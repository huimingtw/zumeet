import type { NextConfig } from "next";

const unoptimized = process.env.NEXT_IMAGE_UNOPTIMIZED === "true";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    unoptimized,
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
