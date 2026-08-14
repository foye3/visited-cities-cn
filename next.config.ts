import type { NextConfig } from "next";

const basePath = process.env.PAGES_BASE_PATH || "/visited-cities-cn";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_EXPORT_SITE_ADDRESS:
      process.env.NEXT_PUBLIC_EXPORT_SITE_ADDRESS ||
      `foye3.github.io${basePath}`,
  },
};

export default nextConfig;
