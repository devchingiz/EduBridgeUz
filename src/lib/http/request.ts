import "server-only";

import { headers } from "next/headers";

export type RequestContext = {
  ip: string;
  userAgent: string | null;
};

/**
 * `getRequestContext` uses a shared sentinel when no client address is present.
 * Rate limiting on that value would throttle unrelated users together, so only
 * real addresses may be used as counter identifiers.
 */
export function hasClientIp(ip: string | null | undefined): boolean {
  return Boolean(ip && ip !== "unknown");
}

/**
 * Best-effort client context. `x-forwarded-for` is only trustworthy behind a
 * proxy that overwrites it; the deployment runbook requires that. Values are
 * hashed before storage and never logged raw.
 */
export async function getRequestContext(): Promise<RequestContext> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    headerList.get("x-real-ip")?.trim() ||
    "unknown";
  const userAgent = headerList.get("user-agent")?.slice(0, 255) ?? null;
  return { ip, userAgent };
}

/**
 * Defence in depth for cookie-authenticated mutations. Next.js already checks
 * the Origin header for Server Actions; this also covers any route handlers we
 * add later and rejects cross-site form posts explicitly.
 */
export async function assertSameOrigin(): Promise<void> {
  const headerList = await headers();
  const origin = headerList.get("origin");
  if (!origin) return;

  const host =
    headerList.get("x-forwarded-host")?.split(",")[0]?.trim() ??
    headerList.get("host");

  if (!host) return;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new Error("Invalid request origin.");
  }

  if (originHost !== host) {
    throw new Error("Cross-origin request rejected.");
  }
}
