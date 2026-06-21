/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: false },
  experimental: { serverActions: { bodySizeLimit: '5mb' } },
  serverExternalPackages: ['pg', '@prisma/adapter-pg'],
};
export default nextConfig;
