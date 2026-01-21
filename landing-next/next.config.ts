import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  distDir: 'dist',
  trailingSlash: false,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
