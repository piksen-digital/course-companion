/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This allows the app to be embedded in Whop's iframe
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
