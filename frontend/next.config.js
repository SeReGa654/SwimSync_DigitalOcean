/** @type {import('next').NextConfig} */
const backendApiUrl = (process.env.BACKEND_API_URL || 'http://localhost:3001').replace(/\/+$/, '');

const nextConfig = {
  // Dist dir is explicitly controlled by npm scripts via NEXT_DIST_DIR.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${backendApiUrl}/api/:path*` },
    ];
  },
};

module.exports = nextConfig;
