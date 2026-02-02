/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // ESLint is run separately via `npm run lint` (eslint .)
    // next build's built-in lint step doesn't support ESLint 9 flat config
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig