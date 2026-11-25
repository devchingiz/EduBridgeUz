import "server-only";

import { isIP } from "node:net";

import { headers } from "next/headers";

import { getAppUrl } from "@/lib/env";

export type RequestContext = {
  ip: string;
  userAgent: string | null;
};

const UNKNOWN_CLIENT_IP = "unknown";

/**
 * Only syntactically valid IPv4/IPv6 values may become rate-limit identities.
 * `getRequestContext` uses a shared sentinel when no usable address is present;
 * using that sentinel or arbitrary header text as a key would throttle
 * unrelated users together.
 */
export function hasClientIp(ip: string | null | undefined): boolean {
  if (typeof ip !== "string") return false;

  const candidate = ip.trim();
  if (!candidate || candidate.toLowerCase() === UNKNOWN_CLIENT_IP) return false;

  return isIP(candidate) !== 0;
}

/**
 * Best-effort client context. `x-forwarded-for` takes precedence over
 * `x-real-ip`, but the leftmost forwarded value is used only when it is a
 * valid IP. Application code cannot prove that forwarded headers were set by a
 * trusted proxy: the ingress must overwrite client-supplied values as required
 * by `docs/DEPLOYMENT.md`. Values are hashed before storage and never logged
 * raw.
 */
export async function getRequestContext(): Promise<RequestContext> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headerList.get("x-real-ip")?.trim();
  const ip = [forwarded, realIp].find(hasClientIp) ?? UNKNOWN_CLIENT_IP;
  const userAgent = headerList.get("user-agent")?.slice(0, 255) ?? null;
  return { ip, userAgent };
}

/**
 * Defence in depth for cookie-authenticated mutations. Next.js already checks
 * the Origin header for Server Actions; this also covers route handlers and
 * rejects cross-site form posts explicitly.
 *
 * Neither `x-forwarded-host` nor `x-forwarded-for` is trusted here: a client
 * can set those headers itself when the ingress forwards them unchanged. The
 * configured public origin is the primary allowlist, with the browser-controlled
 * `Host` header as a local-development fallback. Ingress must still strip or
 * overwrite forwarded headers (see `docs/DEPLOYMENT.md`).
 */
export async function assertSameOrigin(): Promise<void> {
  const headerList = await headers();
  const origin = headerList.get("origin");
  if (!origin) return;

  let requestOrigin: URL;
  try {
    requestOrigin = new URL(origin);
  } catch {
    throw new Error("Invalid request origin.");
  }

  let configuredOrigin: URL | null = null;
  try {
    configuredOrigin = new URL(getAppUrl());
  } catch {
    configuredOrigin = null;
  }

  const allowedHosts = new Set<string>();
  if (configuredOrigin) allowedHosts.add(configuredOrigin.host);
  const host = headerList.get("host")?.trim();
  if (host) allowedHosts.add(host);

  if (allowedHosts.size === 0 || !allowedHosts.has(requestOrigin.host)) {
    throw new Error("Cross-origin request rejected.");
  }

  // A configured HTTPS deployment must never accept an HTTP Origin.
  if (
    configuredOrigin?.protocol === "https:" &&
    requestOrigin.protocol !== "https:"
  ) {
    throw new Error("Cross-origin request rejected.");
  }
}
