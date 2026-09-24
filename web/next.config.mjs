/**
 * Security and cache headers live here, not in vercel.json: Vercel ignores
 * `headers`, `redirects` and `rewrites` from vercel.json for Next.js projects.
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  transpilePackages: ["@thesis/shared"],
  // Lets a verification build write elsewhere, so it cannot clobber the chunks
  // a running dev server is serving.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {key: "X-Content-Type-Options", value: "nosniff"},
          {key: "X-Frame-Options", value: "DENY"},
          {key: "Referrer-Policy", value: "strict-origin-when-cross-origin"},
          {key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()"}
        ]
      },
      {
        // Prices and balances must never be served stale from a CDN edge.
        source: "/api/:path*",
        headers: [{key: "Cache-Control", value: "no-store, must-revalidate"}]
      }
    ];
  }
};

export default nextConfig;
