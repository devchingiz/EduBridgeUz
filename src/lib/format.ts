export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

export function formatDate(
  value: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
): string {
  if (!value) return "Not set";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return new Intl.DateTimeFormat("en", options).format(date);
}

export function formatDateTime(
  value: Date | string | null | undefined,
): string {
  return formatDate(value, { dateStyle: "medium", timeStyle: "short" });
}

export function relativeTime(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;

  return formatDate(date);
}

export function formatBudget(
  amount: number | null,
  currency: string | null,
): string {
  if (!amount || !currency) return "Not set";
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString("en")} ${currency}`;
  }
}

/** A short, human label for a stored user agent. */
export function describeUserAgent(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";

  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Chrome\//.test(userAgent)
      ? "Chrome"
      : /Safari\//.test(userAgent)
        ? "Safari"
        : /Firefox\//.test(userAgent)
          ? "Firefox"
          : "Browser";

  const platform = /Windows/.test(userAgent)
    ? "Windows"
    : /Macintosh|Mac OS X/.test(userAgent)
      ? "macOS"
      : /Android/.test(userAgent)
        ? "Android"
        : /iPhone|iPad/.test(userAgent)
          ? "iOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : null;

  return platform ? `${browser} on ${platform}` : browser;
}
