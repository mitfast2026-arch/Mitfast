/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'plus.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'qubphaacuuwlpdrsprjl.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      // Tigris public content domains (new uploads)
      {
        protocol: 'https',
        hostname: '**.t3.tigrisfiles.io',
      },
      {
        protocol: 'https',
        hostname: '**.t3.tigrisbucket.io',
      },
      {
        protocol: 'https',
        hostname: '**.t3.tigrisblob.io',
      },
      {
        protocol: 'https',
        hostname: 'mitfast-assets.t3.tigrisfiles.io',
      },
    ],
  },
};

module.exports = nextConfig;
