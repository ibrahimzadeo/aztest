// The web app proxies /api/* to the API container same-origin.
//
// Why: one public domain instead of two. No CORS, no API hostname baked into
// the client bundle at build time, and no authenticated surface of its own
// facing the internet. It also sidesteps Coolify's compose-domain mapping,
// which attached the API's domain to a service that exposes no port.
//
// API_INTERNAL_URL is read at server start (a runtime var, not a build arg),
// and Docker's embedded DNS resolves the compose service name.
const API_INTERNAL_URL = process.env.API_INTERNAL_URL || "http://aztest-api:8000";

const nextConfig = {
  output: "standalone",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_INTERNAL_URL}/api/:path*` }];
  },
};
export default nextConfig;
