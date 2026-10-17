/** @type {import('next').NextConfig} */
// Security headers, CSP and edge-cache headers are owned by WS-E
// (content-seo-engineer). Ported from furor-web's patterns.
//
// Content-Security-Policy notes:
// - Next injects inline bootstrap <script>s, so script-src needs
//   'unsafe-inline' unless nonces are plumbed through middleware on every
//   route (real CPU cost on Workers). Everything else is locked down.
// - Razorpay Checkout: script from checkout.razorpay.com, iframe from
//   api.razorpay.com / checkout.razorpay.com, XHR to api + lumberjack.
// - static.cloudflareinsights.com / cloudflareinsights.com cover the Web
//   Analytics beacon Cloudflare injects at the edge.
// - img-src allows https: for seed placeholders (placehold.co) and external
//   editorial images; uploads are served same-origin from /media.
// - React Fast Refresh needs eval() in dev only; production stays eval-free.
const devEval = process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : '';

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${devEval} https://checkout.razorpay.com https://static.cloudflareinsights.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com https://cloudflareinsights.com",
  "media-src 'self' https:",
  'frame-src https://api.razorpay.com https://checkout.razorpay.com',
  'upgrade-insecure-requests',
].join('; ');

const CANONICAL_HOST = 'nowhenceclothings.com';
const NO_STORE = [
  { key: 'Cache-Control', value: 'no-store, private' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
];

const nextConfig = {
  reactStrictMode: true,
  // Always block on metadata so every crawler sees <title>/canonical in <head>.
  htmlLimitedBots: /.*/,
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  images: { unoptimized: true },
  async redirects() {
    // www → apex; the apex is the only canonical origin.
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: `www.${CANONICAL_HOST}` }],
        destination: `https://${CANONICAL_HOST}/:path*`,
        permanent: true,
      },
    ];
  },
  // The OpenNext routing layer applies these on Cloudflare Workers. Later
  // matching rules win per header key.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.razorpay.com" "https://api.razorpay.com")' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          { key: 'Content-Security-Policy', value: CSP },
        ],
      },
      // Public HTML: short shared-cache window, only for visitors without an
      // admin session (that variant must never enter a shared cache).
      // DEPLOY STEP: Cloudflare does not cache HTML by default; add a zone
      // Cache Rule (hostname = nowhenceclothings.com AND path not /admin, /api,
      // /cart, /checkout, /orders → Eligible for cache, respect origin).
      {
        source: '/((?!admin(?:/|$)|api(?:/|$)|media(?:/|$)|cart(?:/|$)|checkout(?:/|$)|orders(?:/|$)|_next(?:/|$)).*)',
        missing: [{ type: 'cookie', key: 'nowhence_admin' }],
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, s-maxage=60, stale-while-revalidate=600' }],
      },
      // Home (WS-H perf): most-hit page, changes only on admin publish. Longer
      // shared window; there is no edge purge on publish yet, so an edit shows
      // within 5 minutes (stale copies refresh in the background).
      {
        source: '/',
        missing: [{ type: 'cookie', key: 'nowhence_admin' }],
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400' }],
      },
      // Uploaded media is immutable (media/{id}/{w}.{fmt}); opaque bytes get
      // a stricter CSP than the site.
      {
        source: '/media/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'Content-Security-Policy', value: "default-src 'none'; sandbox" },
        ],
      },
      { source: '/admin', headers: NO_STORE },
      { source: '/admin/:path*', headers: NO_STORE },
      { source: '/api/:path*', headers: NO_STORE },
      // Cart, checkout and order pages hold personal data.
      { source: '/cart', headers: NO_STORE },
      { source: '/checkout/:path*', headers: NO_STORE },
      { source: '/checkout', headers: NO_STORE },
      { source: '/orders/:path*', headers: NO_STORE },
      // Only nowhenceclothings.com is indexable: workers.dev, previews and any
      // other host get noindex on every response.
      {
        source: '/:path*',
        missing: [{ type: 'host', value: CANONICAL_HOST }],
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

export default nextConfig;
