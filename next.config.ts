import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep tracing and dev-root discovery scoped to this repository even when a
  // parent directory happens to contain another package-lock.json.
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
