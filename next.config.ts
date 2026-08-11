import type { NextConfig } from "next";

const isGitHubPagesBuild = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = isGitHubPagesBuild
  ? {
      output: "export",
      basePath: process.env.PAGES_BASE_PATH || "/visited-cities-cn",
      trailingSlash: true,
      images: {
        unoptimized: true,
      },
      typescript: {
        tsconfigPath: "./tsconfig.pages.json",
      },
    }
  : {};

export default nextConfig;
