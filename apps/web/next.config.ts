import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
  transpilePackages: ["@tagawallet/shared"],
  outputFileTracingRoot: path.join(__dirname, "../.."),
  poweredByHeader: false,
};
export default config;
