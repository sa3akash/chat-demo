import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        port: "4400",
        hostname:"localhost"
      }
    ]
  }
};

export default nextConfig;
