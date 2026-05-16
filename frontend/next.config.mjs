/** @type {import('next').NextConfig} */
const nextConfig =
  process.env.NODE_ENV === "development"
    ? {
        // Dev mode: full Next.js server with proxy to FastAPI backend on port 8000
        async rewrites() {
          return [
            {
              source: "/api/:path*",
              destination: "http://localhost:8000/api/:path*",
            },
          ];
        },
      }
    : {
        // Production/build: static export served by FastAPI (same origin, no proxy needed)
        output: "export",
        images: { unoptimized: true },
      };

export default nextConfig;
