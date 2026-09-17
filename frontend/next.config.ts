import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "media-src 'self' data: blob:",
      "connect-src 'self' https:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  /**
   * The resume parsers must never be bundled into a server chunk.
   *
   * `pdf-parse` delegates to `pdfjs-dist`, whose legacy build resolves its
   * worker module relative to its own module URL (`GlobalWorkerOptions.workerSrc
   * ||= "./pdf.worker.mjs"`). When Next.js inlines pdfjs into
   * `.next/server/chunks/<hash>_pdfjs-dist_*.js` and emits no worker file, that
   * relative specifier is resolved against the chunk directory and the request
   * dies with "Setting up fake worker failed: Cannot find module
   * '.../.next/server/chunks/pdfw...'" even though the uploaded PDF is valid.
   *
   * Loading these packages natively from `node_modules` at runtime keeps every
   * internal path resolution pointing at real files. `pdfjs-dist` is listed
   * explicitly so the worker subpath it imports is external too, and
   * `@napi-rs/canvas` (a dependency of pdf-parse that ships a native binary)
   * stays out of the bundler entirely.
   */
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas", "mammoth"],

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
