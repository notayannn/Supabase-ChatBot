import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  async redirects() {
    return [
      {
        source: "/",
        destination: "/chatbot",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
