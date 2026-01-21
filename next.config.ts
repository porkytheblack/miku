import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable static export for Tauri
  output: "export",
  // Disable image optimization since we're not using a server
  images: {
    unoptimized: true,
  },
  // Ensure trailing slashes work correctly in static export
  trailingSlash: true,
};

export default nextConfig;
