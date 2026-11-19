/**
 * Verifies that the local catalog matches the cached QS 2027 research dataset.
 *
 * This is a development/verification utility. It performs no network calls and
 * makes no changes. Run with `npm run db:verify:qs` while the database is up.
 */

import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DATASET_PATH = new URL(
  "../data/qs-2027-universities.json",
  import.meta.url,
);

type QsUniversity = {
  qsNid: number;
  name: string;
  slug: string;
  countryCode: string;
  rankDisplay: string;
};

const dataset = JSON.parse(fs.readFileSync(DATASET_PATH, "utf8")) as {
  universities: QsUniversity[];
};

const [dbCount, records, fieldFactCount, programCount, seedRecords] =
  await Promise.all([
    prisma.university.count(),
    prisma.university.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        qsNid: true,
        countryCode: true,
        rankingDisplay: true,
        verificationStatus: true,
      },
    }),
    prisma.catalogFieldFact.count(),
    prisma.program.count(),
    prisma.university.findMany({
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
    }),
  ]);

const byNid = new Map(
  records.flatMap((row) => (row.qsNid ? [[row.qsNid, row]] : [])),
);
const bySlug = new Map(records.map((row) => [row.slug, row]));
const missingNids = dataset.universities
  .filter((expected) => !byNid.has(expected.qsNid))
  .map((expected) => expected.qsNid);
const mismatchedRanks = dataset.universities.filter((expected) => {
  const row = byNid.get(expected.qsNid);
  return row?.rankingDisplay !== expected.rankDisplay;
});
const duplicateNames = new Map<string, string[]>();
for (const row of records) {
  const key = row.name.trim().toLowerCase();
  duplicateNames.set(key, [...(duplicateNames.get(key) ?? []), row.slug]);
}
const duplicates = [...duplicateNames.entries()].filter(
  ([, slugs]) => slugs.length > 1,
);

const legacyManchester = bySlug.get("the-university-of-manchester");
const seedManchester = bySlug.get("university-of-manchester");

const result = {
  datasetRecords: dataset.universities.length,
  databaseUniversities: dbCount,
  exactly500: dbCount === 500,
  programs: programCount,
  fieldFacts: fieldFactCount,
  missingQsNids: missingNids,
  mismatchedRankCount: mismatchedRanks.length,
  duplicateNames: duplicates,
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
  !result.exactly500 ||
  missingNids.length > 0 ||
  mismatchedRanks.length > 0
) {
  process.exitCode = 1;
}
