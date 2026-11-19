/**
 * Link rules shared by server-side output sanitization and the client Markdown
 * renderer. Keeping them in one module prevents the two layers from drifting.
 */

export const INTERNAL_LINK_PREFIXES = [
  "/dashboard",
  "/universities",
  "/scholarships",
  "/privacy",
  "/terms",
  "/data-sources",
] as const;

export function isInternalLink(value: string): boolean {
  const path = value.trim();
  return INTERNAL_LINK_PREFIXES.some(
    (prefix) =>
      path === prefix ||
      path.startsWith(`${prefix}/`) ||
      path.startsWith(`${prefix}?`) ||
      path.startsWith(`${prefix}#`),
  );
}

export function isSafeExternalLink(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function isSafeHref(value: string | undefined): value is string {
  if (!value) return false;
  return isInternalLink(value) || isSafeExternalLink(value);
}

export function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    return `${url.protocol}//${url.host.toLowerCase()}${path}${url.search}`;
  } catch {
    return trimmed.replace(/\/+$/, "");
  }
}
