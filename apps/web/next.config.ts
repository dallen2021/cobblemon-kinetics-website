import type { NextConfig } from "next";
import path from "node:path";

const development = process.env.NODE_ENV !== "production";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self' https://github.com https://*.supabase.co",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `img-src 'self' data: blob: https://*.supabase.co${development ? " http://127.0.0.1:* http://localhost:*" : ""}`,
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ""}`,
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co${development ? " http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:*" : ""}`,
  ...(development ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ...(development
    ? []
    : [
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      ]),
];

const nextConfig: NextConfig = {
  agentRules: false,
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  outputFileTracingIncludes: {
    "/*": ["../../data/published/**/*.json", "../../packages/domain/schemas/*.json"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
