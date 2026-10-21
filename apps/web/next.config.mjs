/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@openbot/core'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        child_process: false,
        fs: false,
        path: false,
        os: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        'stream/promises': false,
        http: false,
        https: false,
        http2: false,
        zlib: false,
      };
    }
    return config;
  },
};

export default nextConfig;
