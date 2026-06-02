/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "*.knyha.ua" },
      { protocol: "https", hostname: "ulit.render.ua" },
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // canvas is a native module used by fabric.js — not needed server-side
      config.externals = [...(Array.isArray(config.externals) ? config.externals : [config.externals ?? {}]), "canvas"];
    }
    return config;
  },
};

export default nextConfig;
