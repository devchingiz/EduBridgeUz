/** Pure helpers for derived, clearly-labelled catalog benchmarks. */

export type TuitionSourceRow = {
  amountMinor: number;
  currency: string;
  period: string;
  sourceUrl: string | null;
  sourceTitle: string | null;
  verifiedAt: string | null;
};

export type TuitionBenchmark = {
  currency: string;
  period: string;
  averageMinor: number;
  sampleSize: number;
  sourceUrl: string | null;
  sourceTitle: string | null;
  verifiedAt: string | null;
};

export type CountBenchmark = {
  value: string;
  count: number;
};

export function isAnnualPeriod(period: string): boolean {
  return /(year|annum|annual)/i.test(period);
}

/** Average actual sourced amounts, grouped without cross-currency conversion. */
export function buildTuitionBenchmarks(
  rows: TuitionSourceRow[],
): TuitionBenchmark[] {
  const groups = new Map<string, TuitionBenchmark & { totalMinor: number }>();

  for (const row of rows) {
    const currency = row.currency.trim().toUpperCase();
    const period = row.period.trim() || "unspecified period";
    if (
      !currency ||
      !Number.isFinite(row.amountMinor) ||
      row.amountMinor <= 0
    ) {
      continue;
    }

    const key = `${currency}::${period}`;
    const existing = groups.get(key);
    if (existing) {
      existing.totalMinor += row.amountMinor;
      existing.sampleSize += 1;
      if (!existing.sourceUrl && row.sourceUrl) {
        existing.sourceUrl = row.sourceUrl;
        existing.sourceTitle = row.sourceTitle;
      }
      if (
        row.verifiedAt &&
        (!existing.verifiedAt || row.verifiedAt > existing.verifiedAt)
      ) {
        existing.verifiedAt = row.verifiedAt;
      }
      continue;
    }

    groups.set(key, {
      currency,
      period,
      totalMinor: row.amountMinor,
      averageMinor: row.amountMinor,
      sampleSize: 1,
      sourceUrl: row.sourceUrl,
      sourceTitle: row.sourceTitle,
      verifiedAt: row.verifiedAt,
    });
  }

  return [...groups.values()]
    .map(({ totalMinor, ...benchmark }) => ({
      ...benchmark,
      averageMinor: Math.round(totalMinor / benchmark.sampleSize),
    }))
    .sort(
      (a, b) =>
        a.currency.localeCompare(b.currency) ||
        a.period.localeCompare(b.period),
    );
}

/** Count categorical values without turning missing data into a category. */
export function countBenchmarkValues(
  values: (string | null | undefined)[],
): CountBenchmark[] {
  const counts = new Map<string, number>();

  for (const value of values) {
    const normalized = value?.trim();
    if (!normalized) continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export function averageDurationMonths(
  rows: { durationMonths: number | null }[],
): number | null {
  const values = rows
    .map((row) => row.durationMonths)
    .filter((value): value is number => value !== null && value > 0);

  if (values.length === 0) return null;
  return Math.round(
    values.reduce((total, value) => total + value, 0) / values.length,
  );
}
