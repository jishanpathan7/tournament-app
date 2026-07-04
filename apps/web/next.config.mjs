/** @type {import('next').NextConfig} */
const apiProxyTarget = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8000";

/** Strict security headers applied to every route. */
const SECURITY_HEADERS = [
  // Prevent framing (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // Disable MIME sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Leak only origin (no path/query) on cross-origin navigations.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable unnecessary browser features.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

/** Extra-strict Referrer-Policy for capability-token pages (scorekeeper, check-in, invite, verify).
 *  The token is in the URL path/query; sending it as a Referer to any external resource is a leak. */
const CAPABILITY_HEADERS = [
  ...SECURITY_HEADERS.filter((h) => h.key !== "Referrer-Policy"),
  { key: "Referrer-Policy", value: "no-referrer" },
];

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@tournament/shared", "@tournament/api-client"],
  // Same-origin proxy so auth cookies work when browsing at localhost:3000.
  // Cross-origin (localhost → 127.0.0.1) blocks SameSite=Lax cookies on XHR.
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiProxyTarget}/api/v1/:path*`,
      },
    ];
  },
  async headers() {
    return [
      // Default: apply security headers to every route.
      { source: "/(.*)", headers: SECURITY_HEADERS },
      // Capability pages: no-referrer so tokens don't leak via Referer header.
      { source: "/scorekeeper/:path*", headers: CAPABILITY_HEADERS },
      { source: "/checkin/:path*", headers: CAPABILITY_HEADERS },
      { source: "/invite", headers: CAPABILITY_HEADERS },
      { source: "/verify-email", headers: CAPABILITY_HEADERS },
    ];
  },
};

export default nextConfig;
