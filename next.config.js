/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true
  },
  // Only use static export for GitHub Pages (not Vercel)
  ...(process.env.NODE_ENV === 'production' && 
      process.env.VERCEL !== '1' && {
    output: 'export',
    basePath: '/Support_AI',
    assetPrefix: '/Support_AI/',
  }),
};

module.exports = nextConfig; 