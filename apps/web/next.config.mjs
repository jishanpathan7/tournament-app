/** @type {import('next').NextConfig} */
const apiProxyTarget = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8000";
const isProd = process.env.NODE_ENV === "production";

/**
 * Content-Security-Policy.
 *
 * 'unsafe-inline' is included for style-src because Tailwind/shadcn inject
 * inline styles at runtime.  script-src stays without it — all JS is bundled
 * by Next.js and served from 'self'.  'unsafe-eval' is excluded; Next.js does
 * not require it in production.
 *
 * In development we allow ws: and http: for HMR.
 */
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self'",
  // Tailwind/shadcn use inline styles; strict-dynamic is not compatible with class-based CSS.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  // API is same-origin in production (proxied). Sentry ingest is always allowed
  // so that browser error reports can reach Sentry. Allow ws: in dev for HMR.
  isProd
    ? "connect-src 'self' https://*.sentry.io"
    : "connect-src 'self' ws: http: https:",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
]
  .join("; ")
  .trim();

/** Strict security headers applied to every route. */
const SECURITY_HEADERS = [
  // Prevent framing (clickjacking) — belt-and-suspenders with CSP frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },
  // Disable MIME sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Leak only origin (no path/query) on cross-origin navigations.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable unnecessary browser features.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // HSTS — only set in production; 1 year with includeSubDomains.
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
  { key: "Content-Security-Policy", value: CSP_DIRECTIVES },
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
