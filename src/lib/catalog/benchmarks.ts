import type { VerificationStatus } from "@prisma/client";
import { cache } from "react";

import "server-only";

import {
  averageDurationMonths,
  buildTuitionBenchmarks,
  countBenchmarkValues,
  isAnnualPeriod,
  type CountBenchmark,
  type TuitionBenchmark,
} from "@/lib/catalog/benchmark-math";
import { db } from "@/lib/db";

/**
 * Derived planning context from the source-bearing public catalog.
 *
 * These numbers are never university-specific claims. Missing values are
 * excluded, currencies are never converted, and scholarship award amounts are
 * deliberately not estimated because the catalog does not store them.
 */

const benchmarkStatuses: VerificationStatus[] = [
  "VERIFIED",
  "PARTIALLY_VERIFIED",
];

const statusFilter = { in: benchmarkStatuses };

export type BenchmarkSource = {
  url: string | null;
  title: string | null;
  verifiedAt: string | null;
};

export type IntakeBenchmark = {
  month: number;
  count: number;
};

export type CatalogBenchmarks = {
  tuition: TuitionBenchmark[];
  annualTuition: TuitionBenchmark[];
  fundingMix: CountBenchmark[];
  scholarshipRecords: number;
  scholarshipSource: BenchmarkSource | null;
  languages: CountBenchmark[];
  languageRecords: number;
  intakeMonths: IntakeBenchmark[];
  intakeRecords: number;
  averageDurationMonths: number | null;
  durationRecords: number;
  programRecords: number;
  programSource: BenchmarkSource | null;
};

const emptySource: BenchmarkSource = {
  url: null,
  title: null,
  verifiedAt: null,
};

function isoDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function validSource(
  source: { url: string; title: string; verifiedAt: Date | null } | null,
): BenchmarkSource {
  if (!source || !/^https?:\/\//i.test(source.url)) return emptySource;
  return {
    url: source.url,
    title: source.title,
    verifiedAt: isoDate(source.verifiedAt),
  };
}

/** First source with a usable URL, kept as evidence for aggregate counts. */
function firstProgramSource(
  programs: Array<{
    primarySource: { url: string; title: string; verifiedAt: Date | null };
  }>,
): BenchmarkSource {
  for (const program of programs) {
    const source = validSource(program.primarySource);
    if (source.url) return source;
  }
  return emptySource;
}

export const getCatalogBenchmarks = cache(
  async (): Promise<CatalogBenchmarks> => {
    const [tuitionRows, scholarships, programs] = await Promise.all([
      db.tuitionFact.findMany({
        where: {
          verificationStatus: statusFilter,
          program: { verificationStatus: statusFilter },
        },
        select: {
          amountMinor: true,
          currency: true,
          period: true,
          source: { select: { url: true, title: true, verifiedAt: true } },
        },
      }),
      db.scholarship.findMany({
        where: { verificationStatus: statusFilter },
        select: {
          fundingType: true,
          primarySource: {
            select: { url: true, title: true, verifiedAt: true },
          },
        },
      }),
      db.program.findMany({
        where: { verificationStatus: statusFilter },
        select: {
          language: true,
          durationMonths: true,
          startMonths: true,
          primarySource: {
            select: { url: true, title: true, verifiedAt: true },
          },
        },
      }),
    ]);

    const tuition = buildTuitionBenchmarks(
      tuitionRows.map((row) => {
        const source = validSource(row.source);
        return {
          amountMinor: row.amountMinor,
          currency: row.currency,
          period: row.period,
          sourceUrl: source.url,
          sourceTitle: source.title,
          verifiedAt: source.verifiedAt,
        };
      }),
    );

    const languages = countBenchmarkValues(programs.map((row) => row.language));
    const languageRecords = languages.reduce(
      (total, item) => total + item.count,
      0,
    );

    const intakeCounts = new Map<number, number>();
    let intakeRecords = 0;
    for (const program of programs) {
      for (const month of new Set(program.startMonths)) {
        if (month < 1 || month > 12) continue;
        intakeCounts.set(month, (intakeCounts.get(month) ?? 0) + 1);
        intakeRecords += 1;
      }
    }
    const intakeMonths = [...intakeCounts.entries()]
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => b.count - a.count || a.month - b.month);

    const durationRecords = programs.filter(
      (program) => program.durationMonths !== null,
    ).length;

    return {
      tuition,
      annualTuition: tuition.filter((row) => isAnnualPeriod(row.period)),
      fundingMix: countBenchmarkValues(
        scholarships.map((row) => row.fundingType),
      ),
      scholarshipRecords: scholarships.length,
      scholarshipSource: scholarships.length
        ? validSource(scholarships[0].primarySource)
        : emptySource,
      languages,
      languageRecords,
      intakeMonths,
      intakeRecords,
      averageDurationMonths: averageDurationMonths(programs),
      durationRecords,
      programRecords: programs.length,
      programSource: firstProgramSource(programs),
    };
  },
);
