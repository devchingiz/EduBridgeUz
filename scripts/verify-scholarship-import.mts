/**
 * Verifies that the researched scholarship import reached the local database.
 *
 * Reads `data/scholarship-research-import-report.json`, checks every recorded
 * slug against the database, and reports duplicates or source mismatches. This
 * utility performs no network calls and makes no changes.
 *
 * Run with `npm run db:verify:scholarships` while the database is up.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_PATH = path.join(
  ROOT,
  "data",
  "scholarship-research-import-report.json",
);

type ImportedRecord = {
  slug: string;
  name: string;
  providerName: string;
  fundingType: string;
  sourceUrl: string;
  status: string;
};

type ImportReport = {
  dryRun: boolean;
  created: number;
  skippedDuplicates: number;
  records: ImportedRecord[];
};

function normaliseLabel(value: string): string {
  return value
    .toLocaleLowerCase("en")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function duplicateKey(record: { name: string; providerName: string }): string {
  return `${normaliseLabel(record.name)}|${normaliseLabel(record.providerName)}`;
}

if (!fs.existsSync(REPORT_PATH)) {
  throw new Error(
    `No scholarship import report found at ${path.relative(ROOT, REPORT_PATH)}.`,
  );
}

const report = JSON.parse(fs.readFileSync(REPORT_PATH, "utf8")) as ImportReport;
if (report.dryRun || report.records.length === 0) {
  throw new Error("The import report has no written records to verify.");
}

const slugs = report.records.map((record) => record.slug);
const rows = await prisma.scholarship.findMany({
  where: { slug: { in: slugs } },
  include: { primarySource: { select: { url: true, verifiedAt: true } } },
  orderBy: { slug: "asc" },
});
const bySlug = new Map(rows.map((row) => [row.slug, row]));

const missing = report.records
  .filter((record) => !bySlug.has(record.slug))
  .map((record) => record.slug);
const mismatches = report.records.flatMap((record) => {
  const row = bySlug.get(record.slug);
  if (!row) return [];
  const issues: string[] = [];
  if (row.name !== record.name) issues.push(`${record.slug}: name`);
  if (row.providerName !== record.providerName) {
    issues.push(`${record.slug}: providerName`);
  }
  if (row.fundingType !== record.fundingType) {
    issues.push(`${record.slug}: fundingType`);
  }
  if (row.verificationStatus !== record.status) {
    issues.push(`${record.slug}: status`);
  }
  if (row.primarySource.url !== record.sourceUrl) {
    issues.push(`${record.slug}: sourceUrl`);
  }
  if (!row.primarySource.verifiedAt) {
    issues.push(`${record.slug}: source verification date`);
  }
  return issues;
});

const allScholarships = await prisma.scholarship.findMany({
  select: { id: true, slug: true, name: true, providerName: true },
});
const grouped = new Map<string, string[]>();
for (const row of allScholarships) {
  const key = duplicateKey(row);
  grouped.set(key, [...(grouped.get(key) ?? []), row.slug]);
}
const duplicates = [...grouped.entries()]
  .filter(([, values]) => values.length > 1)
  .map(([key, values]) => ({ key, slugs: values }));

const result = {
  reportCreated: report.created,
  reportSkippedDuplicates: report.skippedDuplicates,
  expectedRecords: report.records.length,
  foundRecords: rows.length,
  missing,
  mismatches,
  duplicates,
  databaseScholarships: allScholarships.length,
  statusCounts: rows.reduce<Record<string, number>>((counts, row) => {
    counts[row.verificationStatus] = (counts[row.verificationStatus] ?? 0) + 1;
    return counts;
  }, {}),
  fundingCounts: rows.reduce<Record<string, number>>((counts, row) => {
    counts[row.fundingType] = (counts[row.fundingType] ?? 0) + 1;
    return counts;
  }, {}),
};

console.log(JSON.stringify(result, null, 2));

await prisma.$disconnect();
if (
  missing.length > 0 ||
  mismatches.length > 0 ||
  duplicates.length > 0 ||
  rows.length !== report.records.length
) {
  process.exitCode = 1;
}
