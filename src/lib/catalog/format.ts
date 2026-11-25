import type { VerificationStatusValue } from "@/lib/catalog/constants";

/**
 * Pure formatting helpers for catalog facts. They never invent a year: a
 * provider that publishes "1 February – 31 May" is rendered as a recurring
 * month and day, not as a calendar date in an assumed cycle.
 */

export function formatMoney(amountMinor: number, currency: string): string {
  const fractionDigits = amountMinor % 100 === 0 ? 0 : 2;
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: fractionDigits,
      minimumFractionDigits: fractionDigits,
    }).format(amountMinor / 100);
  } catch {
    return `${(amountMinor / 100).toLocaleString("en")} ${currency}`;
  }
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** `"02-01"` becomes `"1 February"`. No year is implied or displayed. */
export function formatMonthDay(monthDay: string | null): string | null {
  if (!monthDay) return null;
  const [month, day] = monthDay.split("-").map(Number);
  const name = MONTH_NAMES[month - 1];
  if (!name || !day) return null;
  return `${day} ${name}`;
}

export function formatDeadlineLabel(deadline: {
  deadlineOn: string | null;
  deadlineMonthDay: string | null;
  note: string | null;
}): string {
  if (deadline.deadlineOn) {
    return new Intl.DateTimeFormat("en", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${deadline.deadlineOn}T00:00:00Z`));
  }
  const recurring = formatMonthDay(deadline.deadlineMonthDay);
  if (recurring) return `${recurring} (annual)`;
  return deadline.note ? "See note" : "Not published";
}

export function formatDeadlineWindow(deadline: {
  opensOn: string | null;
  deadlineOn: string | null;
  opensMonthDay: string | null;
  deadlineMonthDay: string | null;
}): string | null {
  const opens = deadline.opensOn
    ? new Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${deadline.opensOn}T00:00:00Z`))
    : formatMonthDay(deadline.opensMonthDay);
  const closes = deadline.deadlineOn
    ? formatDeadlineLabel({
        deadlineOn: deadline.deadlineOn,
        deadlineMonthDay: null,
        note: null,
      })
    : formatMonthDay(deadline.deadlineMonthDay);
  if (!opens && !closes) return null;
  if (opens && closes) return `${opens} – ${closes}`;
  return opens ?? closes;
}

/**
 * Prefers the provider's own wording. Month numbers are only expanded when the
 * provider actually published months, so "Winter and summer semester" is never
 * rewritten as a calendar guess.
 */
export function formatStart(
  startMonths: number[],
  startNote: string | null,
): string | null {
  if (startNote) return startNote;
  if (startMonths.length === 0) return null;
  return startMonths
    .map((month) =>
      new Intl.DateTimeFormat("en", {
        month: "long",
        timeZone: "UTC",
      }).format(new Date(Date.UTC(2020, month - 1, 1))),
    )
    .join(", ");
}

export type DeadlineState = "open" | "upcoming" | "closed" | "unknown";

/**
 * Best-effort state for a deadline. Exact dates are compared as calendar days.
 * Recurring month-days are compared without a year, so the result describes the
 * current annual window rather than a specific intake.
 */
export function deadlineState(
  deadline: {
    opensOn: string | null;
    deadlineOn: string | null;
    opensMonthDay: string | null;
    deadlineMonthDay: string | null;
  },
  now: Date = new Date(),
): DeadlineState {
  const today = now.toISOString().slice(0, 10);

  if (deadline.deadlineOn) {
    if (today > deadline.deadlineOn) return "closed";
    if (deadline.opensOn && today < deadline.opensOn) return "upcoming";
    return "open";
  }

  if (deadline.deadlineMonthDay) {
    const todayMonthDay = today.slice(5);
    const opens = deadline.opensMonthDay;
    const closes = deadline.deadlineMonthDay;
    if (opens && opens > closes) {
      // Window crosses the new year, for example 1 October – 15 January.
      return todayMonthDay >= opens || todayMonthDay <= closes
        ? "open"
        : "upcoming";
    }
    if (todayMonthDay > closes) return "closed";
    if (opens && todayMonthDay < opens) return "upcoming";
    return "open";
  }

  return "unknown";
}

export function verificationBadgeVariant(
  status: VerificationStatusValue,
): "success" | "warning" | "outline" | "muted" {
  switch (status) {
    case "VERIFIED":
      return "success";
    case "PARTIALLY_VERIFIED":
      return "warning";
    case "NEEDS_REVIEW":
      return "warning";
    case "INFORMATION_UNAVAILABLE":
    case "UNVERIFIED":
      return "outline";
    default:
      return "muted";
  }
}

/** A concise "checked on" line for a fact or record. */
export function formatCheckedOn(verifiedAt: string | null): string {
  if (!verifiedAt) return "Not yet verified";
  const formatted = new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${verifiedAt}T00:00:00Z`));
  return `Checked ${formatted}`;
}

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  quot: '"',
  lt: "<",
  gt: ">",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  laquo: "«",
  raquo: "»",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  copy: "©",
  reg: "®",
  trade: "™",
  deg: "°",
};

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#(x[\da-f]+|\d+);/gi, (match, encoded: string) => {
      const codePoint =
        encoded[0]?.toLowerCase() === "x"
          ? Number.parseInt(encoded.slice(1), 16)
          : Number.parseInt(encoded, 10);
      if (
        !Number.isFinite(codePoint) ||
        codePoint < 0 ||
        codePoint > 0x10ffff
      ) {
        return match;
      }
      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return match;
      }
    })
    .replace(/&([a-z][a-z0-9]+);/gi, (match, name: string) => {
      return HTML_ENTITIES[name.toLowerCase()] ?? match;
    });
}

/** Removes markup without a DOM so the helper also works in Server Components. */
function stripHtml(value: string): string {
  let output = "";
  let index = 0;
  let skipUntil: string | null = null;
  const lower = value.toLowerCase();

  while (index < value.length) {
    if (skipUntil) {
      const skipIndex = lower.indexOf(skipUntil, index);
      if (skipIndex === -1) break;
      const closeEnd = value.indexOf(">", skipIndex);
      index = closeEnd === -1 ? skipIndex + skipUntil.length : closeEnd + 1;
      output += " ";
      continue;
    }

    if (value.startsWith("<!--", index)) {
      const commentEnd = value.indexOf("-->", index);
      index = commentEnd === -1 ? value.length : commentEnd + 3;
      output += " ";
      continue;
    }

    if (value[index] !== "<" || !/[a-z!/]/i.test(value[index + 1] ?? "")) {
      output += value[index];
      index += 1;
      continue;
    }

    const tagStart = index;
    let quote: '"' | "'" | null = null;
    let tagName = "";
    let tagNameDone = false;
    let lastSignificant = "";
    let closed = false;
    index += 1;

    while (index < value.length) {
      const char = value[index];
      if (quote) {
        if (char === quote) quote = null;
        index += 1;
        continue;
      }
      if (char === '"' || char === "'") {
        quote = char;
        index += 1;
        continue;
      }
      if (char === ">") {
        index += 1;
        closed = true;
        break;
      }
      if (!tagNameDone && /[a-z]/i.test(char)) {
        tagName += char.toLowerCase();
      } else if (tagName && /\s/.test(char)) {
        tagNameDone = true;
      }
      if (!/\s/.test(char)) lastSignificant = char;
      index += 1;
    }

    // QS snippets can end mid-tag. A dangling tag fragment is still markup;
    // a bare "<" (for example "fewer than < 3 km") is ordinary content.
    if (!closed) {
      const fragment = value.slice(tagStart);
      output += /^<\/?[a-z][a-z0-9-]*(?=[\s/>]|$)/i.test(fragment)
        ? " "
        : fragment;
      break;
    }

    output += " ";
    const name = tagName.replace(/^\//, "");
    if (
      !tagName.startsWith("/") &&
      (name === "script" || name === "style") &&
      lastSignificant !== "/"
    ) {
      skipUntil = `</${name}`;
    }
  }

  return output;
}

/**
 * QS pastes rich-text into its index. This strips that markup at render time so
 * stored source records and their provenance remain untouched.
 */
export function plainText(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = decodeHtmlEntities(stripHtml(value))
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}
