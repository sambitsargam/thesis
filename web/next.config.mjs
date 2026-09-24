/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@thesis/shared"],
  // Lets a verification build write somewhere else, so it cannot clobber the
  // chunks a running dev server is serving.
  distDir: process.env.NEXT_DIST_DIR || ".next"
};

export default nextConfig;
