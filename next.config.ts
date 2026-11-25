import type { NextConfig } from "next";

/**
 * Enforcing CSP. Next.js injects inline bootstrap scripts and styles, and the
 * catalog pages use inline `application/ld+json` data blocks, so `unsafe-inline`
 * is required for scripts/styles until a per-request nonce can be applied.
 * A nonce strategy would force every page to be dynamically rendered; that is a
 * deliberate architecture change and is tracked as a remaining hardening item.
 * All other directives are strict: no plugins, no base-tag hijacking, no
 * cross-origin forms except the Google OAuth redirect used by sign-up, and no
 * framing.
 */
function contentSecurityPolicy(): string {
  const isDev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://accounts.google.com",
    "frame-ancestors 'none'",
    // Local development serves plain HTTP; upgrading it would break the dev
    // server itself. Production is HTTPS-only and always upgrades.
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  { key: "Content-Security-Policy", value: contentSecurityPolicy() },
];

/**
 * Next.js compares a Server Action's `Origin` host against `x-forwarded-host`
 * when a proxy is present. Local tunnels can inject their own forwarded host
 * while the browser still sends `Origin: localhost:3000`, which otherwise
 * aborts every action with "Invalid Server Actions request.". Only local
 * browser hosts are allowed, and only outside production, so deployed apps
 * keep the strict same-origin default.
 */
function developmentServerActionOrigins(): string[] {
  const origins = new Set(["localhost:3000", "127.0.0.1:3000"]);
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
        origins.add(url.host);
      }
    } catch {
      // An invalid public URL must not widen the allowlist.
    }
  }
  return [...origins];
}

const developmentServerActions =
  process.env.NODE_ENV === "production"
    ? undefined
    : { serverActions: { allowedOrigins: developmentServerActionOrigins() } };

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: developmentServerActions,
  async headers() {
    const headers = [...securityHeaders];

    if (process.env.NODE_ENV === "production") {
      headers.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }

    return [
      {
        source: "/:path*",
        headers,
      },
      // Listed last so these override the global Referrer-Policy. Verification
      // and reset links carry a raw token in the query string and must never be
      // sent as a referrer, even to same-origin resources.
      {
        source: "/verify-email/:path*",
        headers: [
          {
            key: "Referrer-Policy",
            value: "no-referrer",
          },
        ],
      },
      {
        source: "/reset-password/:path*",
        headers: [
          {
            key: "Referrer-Policy",
            value: "no-referrer",
          },
        ],
      },
      // Guardian consent tokens are path segments. The client also removes the
      // token from history after the hidden form field has captured it.
      {
        source: "/guardian-consent/:path*",
        headers: [
          {
            key: "Referrer-Policy",
            value: "no-referrer",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
