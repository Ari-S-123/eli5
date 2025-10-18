import type { NextConfig } from 'next';

/**
 * Next.js configuration with Node polyfills for Daytona SDK
 * 
 * Daytona SDK requires Node.js modules that need to be polyfilled
 * for browser and edge runtime compatibility in Next.js.
 */
const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Polyfill Node.js modules for client-side compatibility with Daytona SDK
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        path: false,
        os: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
      };
    }
    return config;
  },
};

export default nextConfig;
