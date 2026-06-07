import "@alphonse/env/web";
import type { NextConfig } from "next";

const isTauri = process.env.TAURI_ENV_PLATFORM !== undefined;

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: true,
  ...(isTauri && { output: "export", trailingSlash: true }),
};

export default nextConfig;
