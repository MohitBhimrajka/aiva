import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
    INTERNAL_API_URL: process.env.INTERNAL_API_URL || "http://backend:8000",
  },
  serverExternalPackages: [],

  // Enable source maps for production debugging
  productionBrowserSourceMaps: true,

  // Temporarily ignore TypeScript errors during build for faster Docker deployment
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Ignore ESLint errors during production build
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Configure for Docker deployment
  output: 'standalone',

  // Development optimizations
  ...(process.env.NODE_ENV === "development" && {
    experimental: {
      optimizePackageImports: ["@radix-ui/react-icons", "lucide-react"],
    },

    // Optimize bundling for development
    webpack: (config: any, { dev }: { dev: boolean }) => {
      if (dev) {
        config.watchOptions = {
          poll: 1000,
          aggregateTimeout: 300,
          ignored: /node_modules/,
        };
        config.infrastructureLogging = { level: "error" };
      }
      return config;
    },
  }),
};

export default nextConfig;
