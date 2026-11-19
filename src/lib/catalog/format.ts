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
