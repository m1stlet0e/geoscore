/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: false },
  experimental: { serverActions: { bodySizeLimit: '5mb' } },
};
export default nextConfig;
