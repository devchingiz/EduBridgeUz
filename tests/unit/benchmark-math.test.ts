import { describe, expect, it } from "vitest";

import {
  averageDurationMonths,
  buildTuitionBenchmarks,
  countBenchmarkValues,
  isAnnualPeriod,
  type TuitionSourceRow,
} from "@/lib/catalog/benchmark-math";

function tuitionRow(
  overrides: Partial<TuitionSourceRow> = {},
): TuitionSourceRow {
  return {
    amountMinor: 100_000,
    currency: "EUR",
    period: "per academic year",
    sourceUrl: "https://example.edu/tuition",
    sourceTitle: "Example tuition page",
    verifiedAt: "2026-06-18",
    ...overrides,
  };
}

describe("isAnnualPeriod", () => {
  it("recognizes annual wording without guessing at unspecified periods", () => {
    expect(isAnnualPeriod("per academic year")).toBe(true);
    expect(isAnnualPeriod("Per Annum")).toBe(true);
    expect(isAnnualPeriod("annual")).toBe(true);
    expect(isAnnualPeriod("per semester")).toBe(false);
    expect(isAnnualPeriod("")).toBe(false);
  });
});

describe("buildTuitionBenchmarks", () => {
  it("averages sourced amounts within each currency and period", () => {
    const result = buildTuitionBenchmarks([
      tuitionRow({ amountMinor: 100_000 }),
      tuitionRow({
        amountMinor: 200_000,
        sourceUrl: "https://example.edu/second",
        verifiedAt: "2026-07-01",
      }),
      tuitionRow({ amountMinor: 90_000, currency: "GBP" }),
      tuitionRow({
        amountMinor: 50_000,
        period: "per semester",
        sourceUrl: "https://example.edu/semester",
      }),
    ]);

    expect(result).toEqual([
      {
        currency: "EUR",
        period: "per academic year",
        averageMinor: 150_000,
        sampleSize: 2,
        sourceUrl: "https://example.edu/tuition",
        sourceTitle: "Example tuition page",
        verifiedAt: "2026-07-01",
      },
      {
        currency: "EUR",
        period: "per semester",
        averageMinor: 50_000,
        sampleSize: 1,
        sourceUrl: "https://example.edu/semester",
        sourceTitle: "Example tuition page",
        verifiedAt: "2026-06-18",
      },
      {
        currency: "GBP",
        period: "per academic year",
        averageMinor: 90_000,
        sampleSize: 1,
        sourceUrl: "https://example.edu/tuition",
        sourceTitle: "Example tuition page",
        verifiedAt: "2026-06-18",
      },
    ]);
  });

  it("skips invalid amounts and normalizes missing period labels", () => {
    const result = buildTuitionBenchmarks([
      tuitionRow({ amountMinor: 0 }),
      tuitionRow({ amountMinor: Number.NaN }),
      tuitionRow({ currency: " " }),
      tuitionRow({ amountMinor: 80_000, period: "" }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      currency: "EUR",
      period: "unspecified period",
      averageMinor: 80_000,
      sampleSize: 1,
    });
  });
});

describe("countBenchmarkValues", () => {
  it("counts categorical values and ignores missing ones", () => {
    expect(
      countBenchmarkValues([
        "English",
        "English",
        " German ",
        null,
        undefined,
        "  ",
      ]),
    ).toEqual([
      { value: "English", count: 2 },
      { value: "German", count: 1 },
    ]);
  });
});

describe("averageDurationMonths", () => {
  it("ignores missing and non-positive durations", () => {
    expect(
      averageDurationMonths([
        { durationMonths: 12 },
        { durationMonths: null },
        { durationMonths: 24 },
        { durationMonths: 0 },
      ]),
    ).toBe(18);
    expect(averageDurationMonths([{ durationMonths: null }])).toBeNull();
  });
});
