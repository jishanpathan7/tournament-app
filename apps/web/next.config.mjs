/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@tournament/shared", "@tournament/api-client"],
};

export default nextConfig;
