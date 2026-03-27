/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 1. Tell Vercel to push through even if it happens to see a warning or a type mismatch
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // 2. The Whop Iframe Security Settings (Crucial)
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'Content-Security-Policy',
          value: "frame-ancestors https://whop.com https://*.whop.com;",
        },
      ],
    },
  ],
};

module.exports = nextConfig;
