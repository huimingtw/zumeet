import type { NextConfig } from "next";

const unoptimized = process.env.NEXT_IMAGE_UNOPTIMIZED === "true";
const apiUpstream = process.env.API_UPSTREAM ?? "http://api:8080";
const storageUpstream = process.env.STORAGE_UPSTREAM ?? "http://storage:9000";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    unoptimized,
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${apiUpstream}/api/:path*` },
      { source: "/storage/:path*", destination: `${storageUpstream}/:path*` },
    ];
  },
};

export default nextConfig;
