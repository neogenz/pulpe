import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  distDir: 'dist',
  trailingSlash: false,
  env: {
    NEXT_PUBLIC_POSTHOG_KEY: process.env.PUBLIC_POSTHOG_API_KEY || process.env.NEXT_PUBLIC_POSTHOG_KEY || '',
    NEXT_PUBLIC_POSTHOG_HOST: process.env.PUBLIC_POSTHOG_HOST || process.env.NEXT_PUBLIC_POSTHOG_HOST || '/ph',
    NEXT_PUBLIC_POSTHOG_ENABLED: process.env.PUBLIC_POSTHOG_ENABLED || process.env.NEXT_PUBLIC_POSTHOG_ENABLED || 'false',
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
}

export default nextConfig
