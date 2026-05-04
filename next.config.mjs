/** @type {import('next').NextConfig} */
const nextConfig = {
  // Skip TS and ESLint during Vercel build — both run locally before push
  typescript: { ignoreBuildErrors: true },
  eslint:     { ignoreDuringBuilds: true },

  // Prevent Next.js from bundling heavy server-only packages.
  // Node.js will load them natively, cutting compile time significantly.
  experimental: {
    serverComponentsExternalPackages: [
      '@react-pdf/renderer',
      'exceljs',
      'googleapis',
      'xlsx',
    ],
  },
};

export default nextConfig;
