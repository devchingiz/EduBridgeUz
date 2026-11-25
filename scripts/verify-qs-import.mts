/**
 * Verifies that the local catalog matches the cached QS 2027 research datasets.
 *
 * This is a development/verification utility. It performs no network calls and
 * makes no changes. With no `--dataset=` flags it verifies every discovered
 * `data/qs-2027-universities*.json` dataset and expects their combined total.
 * Run with `npm run db:verify:qs` while the database is up.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "data");
const DATASET_PATTERN = /^qs-2027-universities(?:-batch-\d+)?\.json$/;

type QsUniversity = {
  qsNid: number;
  name: string;
  slug: string;
  countryCode: string;
  rankDisplay: string;
  qsSourceUrl?: string;
};

type Dataset = {
  meta?: { primarySourceUrl?: string; [key: string]: unknown };
  universities: QsUniversity[];
};

function cliValues(flag: string): string[] {
  return process.argv
    .filter((value) => value.startsWith(`--${flag}=`))
    .map((value) => value.slice(flag.length + 3));
}

function discoverDatasetPaths(): string[] {
  return fs
    .readdirSync(DATA_DIR)
    .filter((file) => DATASET_PATTERN.test(file))
    .sort()
    .map((file) => path.join(DATA_DIR, file));
}

const explicitPaths = cliValues("dataset");
const datasetPaths = explicitPaths.length
  ? explicitPaths.map((value) => path.resolve(ROOT, value))
  : discoverDatasetPaths();
if (datasetPaths.length === 0) {
  throw new Error("No QS university datasets found to verify.");
}

const datasets = datasetPaths.map((filePath) => ({
  file: path.relative(ROOT, filePath),
  data: JSON.parse(fs.readFileSync(filePath, "utf8")) as Dataset,
}));
const expectedRecords = datasets.flatMap(({ file, data }) =>
  data.universities.map((university) => ({ ...university, file })),
);

const expectedArg = process.argv.find((value) =>
  value.startsWith("--expected="),
);
const expectedTotal = expectedArg
  ? Number(expectedArg.slice("--expected=".length))
  : expectedRecords.length;
if (!Number.isInteger(expectedTotal) || expectedTotal < 0) {
  throw new Error(`Invalid --expected value: ${expectedArg ?? expectedTotal}`);
}

function duplicatesOf<T>(values: Array<[string, T]>): Array<[string, T[]]> {
  const grouped = new Map<string, T[]>();
  for (const [key, value] of values) {
    grouped.set(key, [...(grouped.get(key) ?? []), value]);
  }
  return [...grouped.entries()].filter(([, items]) => items.length > 1);
}

const expectedNidDuplicates = duplicatesOf(
  expectedRecords.map((record) => [String(record.qsNid), record.file]),
);

const sourceUrls = [
  ...new Set([
    ...datasets.flatMap(({ data }) =>
      data.meta?.primarySourceUrl ? [data.meta.primarySourceUrl] : [],
    ),
    ...expectedRecords.flatMap((record) =>
      record.qsSourceUrl ? [record.qsSourceUrl] : [],
    ),
  ]),
];

// PGlite's local socket serves one Prisma query at a time, so these reads are
// intentionally sequential rather than wrapped in Promise.all.
const dbCount = await prisma.university.count();
const records = await prisma.university.findMany({
  select: {
    id: true,
    slug: true,
    name: true,
    qsNid: true,
    countryCode: true,
    rankingDisplay: true,
    verificationStatus: true,
  },
});
const fieldFactCount = await prisma.catalogFieldFact.count();
const programCount = await prisma.program.count();
const seedRecords = await prisma.university.findMany({
  where: {
    slug: {
      in: [
        "technical-university-of-munich",
        "university-of-amsterdam",
        "delft-university-of-technology",
        "university-of-manchester",
      ],
    },
  },
  select: { slug: true, name: true, verificationStatus: true },
  orderBy: { slug: "asc" },
});
const sources = await prisma.sourceCitation.findMany({
  where: { url: { in: sourceUrls } },
  select: { url: true },
});

const knownSourceUrls = new Set(sources.map((source) => source.url));
const missingSourceUrls = sourceUrls.filter((url) => !knownSourceUrls.has(url));

const byNid = new Map(
  records.flatMap((row) => (row.qsNid ? [[row.qsNid, row]] : [])),
);
const bySlug = new Map(records.map((row) => [row.slug, row]));
const missingNids = expectedRecords
  .filter((expected) => !byNid.has(expected.qsNid))
  .map((expected) => expected.qsNid);
const mismatchedRanks = expectedRecords.filter((expected) => {
  const row = byNid.get(expected.qsNid);
  return row?.rankingDisplay !== expected.rankDisplay;
});
const duplicateNames = duplicatesOf(
  records.map((row) => [row.name.trim().toLowerCase(), row.slug]),
);
const duplicateSlugs = duplicatesOf(records.map((row) => [row.slug, row.name]));
const duplicateQsNids = duplicatesOf(
  records.flatMap((row) => (row.qsNid ? [[String(row.qsNid), row.slug]] : [])),
);

const legacyManchester = bySlug.get("the-university-of-manchester");
const seedManchester = bySlug.get("university-of-manchester");

const result = {
  datasetFiles: datasets.map(({ file }) => file),
  datasetRecords: expectedRecords.length,
  expectedTotal,
  databaseUniversities: dbCount,
  matchesExpectedTotal: dbCount === expectedTotal,
  programs: programCount,
  fieldFacts: fieldFactCount,
  missingQsNids: missingNids,
  mismatchedRankCount: mismatchedRanks.length,
  missingSourceUrls,
  duplicateExpectedNids: expectedNidDuplicates,
  duplicateNames,
  duplicateSlugs,
  duplicateQsNids,
  seedRecords,
  legacyManchesterDuplicate: Boolean(legacyManchester && seedManchester),
  statusCounts: records.reduce<Record<string, number>>((counts, row) => {
    counts[row.verificationStatus] = (counts[row.verificationStatus] ?? 0) + 1;
    return counts;
  }, {}),
};

console.log(JSON.stringify(result, null, 2));

await prisma.$disconnect();
if (
  !result.matchesExpectedTotal ||
  missingNids.length > 0 ||
  mismatchedRanks.length > 0 ||
  missingSourceUrls.length > 0 ||
  expectedNidDuplicates.length > 0 ||
  duplicateNames.length > 0 ||
  duplicateSlugs.length > 0 ||
  duplicateQsNids.length > 0 ||
  result.legacyManchesterDuplicate
) {
  process.exitCode = 1;
}
