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
  // Proxy all non-NextAuth API calls to Fastify.
  // Client components use relative paths (e.g. /api/users/register).
  // Next.js server rewrites them to the internal API URL at request time.
  async rewrites() {
    const apiBase = process.env.API_INTERNAL_URL || "http://localhost:3001";
    const minioBase = `http://${process.env.MINIO_ENDPOINT || "localhost"}:${process.env.MINIO_PORT || "9000"}/${process.env.MINIO_BUCKET_NAME || "knyha-books"}`;
    return [
      { source: "/api/users/:path*",    destination: `${apiBase}/api/users/:path*` },
      { source: "/api/books/:path*",    destination: `${apiBase}/api/books/:path*` },
      { source: "/api/store/:path*",    destination: `${apiBase}/api/store/:path*` },
      { source: "/api/admin/:path*",    destination: `${apiBase}/api/admin/:path*` },
      { source: "/api/orders/:path*",   destination: `${apiBase}/api/orders/:path*` },
      { source: "/api/payments/:path*", destination: `${apiBase}/api/payments/:path*` },
      { source: "/api/payouts/:path*",  destination: `${apiBase}/api/payouts/:path*` },
      { source: "/api/health",          destination: `${apiBase}/api/health` },
      // Proxy MinIO public assets so browser never hits the internal minio:9000 URL
      { source: "/storage/:path*",      destination: `${minioBase}/:path*` },
    ];
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(Array.isArray(config.externals) ? config.externals : [config.externals ?? {}]), "canvas"];
    }
    return config;
  },
};

export default nextConfig;
