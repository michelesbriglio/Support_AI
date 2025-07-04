/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true
  },
  // Only use static export for production builds (GitHub Pages)
  ...(process.env.NODE_ENV === 'production' && {
    output: 'export',
    basePath: '/Support_AI',
    assetPrefix: '/Support_AI/',
  }),
};

module.exports = nextConfig; 