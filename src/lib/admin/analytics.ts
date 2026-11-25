import type { ApplicationStatus, VerificationStatus } from "@prisma/client";

import {
  VERIFICATION_LABELS,
  VERIFICATION_STATUSES,
  type VerificationStatusValue,
} from "@/lib/catalog/constants";
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
} from "@/lib/workspace/constants";

/**
 * Pure aggregation helpers for the administration overview. These functions
 * never fabricate activity: days without records stay at zero and every chart
 * value is derived from database rows passed in by the server-only loader.
 */

export const TREND_DAYS = 90;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const TREND_METRICS = [
  "accounts",
  "applications",
  "auditEvents",
  "advisorRequests",
] as const;

export type TrendMetric = (typeof TREND_METRICS)[number];

export const TREND_METRIC_LABELS: Record<TrendMetric, string> = {
  accounts: "New accounts",
  applications: "Applications created",
  auditEvents: "Audit events",
  advisorRequests: "AI requests",
};

/** CSS variables are defined for both light and dark themes in globals.css. */
export const TREND_METRIC_COLORS: Record<TrendMetric, string> = {
  accounts: "var(--chart-1)",
  applications: "var(--chart-2)",
  auditEvents: "var(--chart-3)",
  advisorRequests: "var(--chart-4)",
};

export type TrendPoint = {
  /** UTC calendar day in YYYY-MM-DD form. Safe to serialize to the client. */
  date: string;
  label: string;
  accounts: number;
  applications: number;
  auditEvents: number;
  advisorRequests: number;
};

export type StatusBreakdownItem<T extends string = string> = {
  status: T;
  label: string;
  count: number;
};

export function startOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

export function dayKey(value: Date): string {
  return startOfUtcDay(value).toISOString().slice(0, 10);
}

function countByDay(values: readonly Date[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = dayKey(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

const dayLabelFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/**
 * Creates a continuous daily series so a quiet day is visibly different from
 * missing data. `values` are raw timestamps from the database, not estimates.
 */
export function buildTrend(
  values: Record<TrendMetric, readonly Date[]>,
  now: Date = new Date(),
  days: number = TREND_DAYS,
): TrendPoint[] {
  const length = Math.max(1, Math.floor(days));
  const today = startOfUtcDay(now).getTime();
  const start = today - (length - 1) * MS_PER_DAY;
  const end = now.getTime();
  const counts = Object.fromEntries(
    TREND_METRICS.map((metric) => [
      metric,
      countByDay(
        values[metric].filter((value) => {
          const time = value.getTime();
          return time >= start && time <= end;
        }),
      ),
    ]),
  ) as Record<TrendMetric, Map<string, number>>;

  return Array.from({ length }, (_, index) => {
    const day = new Date(start + index * MS_PER_DAY);
    const key = day.toISOString().slice(0, 10);
    return {
      date: key,
      label: dayLabelFormatter.format(day),
      accounts: counts.accounts.get(key) ?? 0,
      applications: counts.applications.get(key) ?? 0,
      auditEvents: counts.auditEvents.get(key) ?? 0,
      advisorRequests: counts.advisorRequests.get(key) ?? 0,
    };
  });
}

/** Used by the client-side range control; never regenerates or guesses data. */
export function sliceTrend(
  points: readonly TrendPoint[],
  days: number,
): TrendPoint[] {
  if (days <= 0) return [];
  return points.slice(-Math.min(days, points.length));
}

export function buildStatusBreakdown<T extends string>(
  statuses: readonly T[],
  counts: Readonly<Partial<Record<T, number>>>,
  labels: Readonly<Record<T, string>>,
): StatusBreakdownItem<T>[] {
  return statuses.map((status) => ({
    status,
    label: labels[status] ?? status,
    count: counts[status] ?? 0,
  }));
}

export function verificationStatusBreakdown(
  counts: Readonly<Partial<Record<VerificationStatusValue, number>>>,
): StatusBreakdownItem<VerificationStatus>[] {
  return buildStatusBreakdown(
    VERIFICATION_STATUSES,
    counts,
    VERIFICATION_LABELS,
  );
}

export const universityStatusBreakdown = verificationStatusBreakdown;
export const scholarshipStatusBreakdown = verificationStatusBreakdown;

export function applicationStatusBreakdown(
  counts: Readonly<Partial<Record<ApplicationStatus, number>>>,
): StatusBreakdownItem<ApplicationStatus>[] {
  return buildStatusBreakdown(
    APPLICATION_STATUSES,
    counts,
    APPLICATION_STATUS_LABELS,
  );
}
