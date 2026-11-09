// Merge this into your existing next.config (keep any options you already have).
const BACKEND = (process.env.BACKEND_URL || 'http://localhost/medrep-api').replace(/\/$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // Browser calls /backend-api/auth/me.php  ->  <BACKEND_URL>/api/auth/me.php
      { source: '/backend-api/:path*', destination: `${BACKEND}/api/:path*` },
    ];
  },
};

module.exports = nextConfig;