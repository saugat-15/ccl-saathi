/** @type {import('next').NextConfig} */

// CSP notes:
//   script-src 'unsafe-inline'  — required by Next.js inline hydration scripts.
//   connect-src *.amazonaws.com — covers AppSync, Cognito IDP, and S3 whose
//     sub-domains vary per Amplify environment.
//   wss://*.amazonaws.com       — AppSync real-time subscriptions.
//   https://script.google.com   — waitlist form POST target.
//   media-src blob: *.amazonaws.com — browser audio capture, Web Audio API, and S3 presigned audio URLs.
const isDev = process.env.NODE_ENV === "development";

const CSP = [
  "default-src 'self'",
  // 'unsafe-eval' is required by React Fast Refresh (HMR) in development only.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https://*.amazonaws.com wss://*.amazonaws.com https://*.amazoncognito.com https://script.google.com",
  "media-src 'self' blob: https://*.amazonaws.com",
  "worker-src blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Content-Security-Policy", value: CSP },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
