/**
 * Imports the hand-researched scholarship dataset into EduBridge.
 *
 * The JSON files in `data/` are built from official provider pages only. This
 * script performs no network calls: every record was checked before it was
 * written to the dataset, and the source URL, publisher, title, access date and
 * verification date travel with each scholarship.
 *
 * Run with `npm run db:import:scholarships` while the local database is running.
 * Use `--dry-run` to validate the dataset and report duplicates without writing.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

import {
  ELIGIBILITY_SCOPES,
  FUNDING_TYPES,
  REVIEW_INTERVAL_DAYS,
} from "../src/lib/catalog/constants.ts";
import { isHttpUrl, slugify } from "../src/lib/catalog/qs-import-mapping.ts";
import { COUNTRY_CODES } from "../src/lib/data/countries.ts";
import { DEGREE_LEVELS } from "../src/lib/data/fields.ts";

const prisma = new PrismaClient();
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "data");
const REPORT_PATH = path.join(
  DATA_DIR,
  "scholarship-research-import-report.json",
);
const DRY_RUN = process.argv.includes("--dry-run");
const IMPORT_NOTE =
  "Imported from an official provider page checked during scholarship research.";

const degreeValues = DEGREE_LEVELS.map((item) => item.value);
const countryCodes = [...COUNTRY_CODES];
const httpUrl = z.string().refine(isHttpUrl, "Use an http or https URL.");
const isoDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)), {
    message: "Use a real calendar date.",
  });

const researchRecordSchema = z
  .object({
    name: z.string().trim().min(2).max(200),
    providerName: z.string().trim().min(2).max(200),
    providerUrl: httpUrl,
    hostCountryCode: z.enum(countryCodes).nullable(),
    fundingType: z.enum(FUNDING_TYPES),
    // An empty list is honest for postdoctoral or non-degree awards; the
    // reviewer UI still requires a degree level when a human edits the record.
    degreeLevels: z.array(z.enum(degreeValues)),
    nationalityScope: z.enum(ELIGIBILITY_SCOPES),
    eligibleNationalities: z.array(z.enum(countryCodes)),
    fieldScope: z.enum(ELIGIBILITY_SCOPES),
    fields: z.array(z.string().trim().min(2).max(120)),
    summary: z.string().trim().min(20).max(1200),
    sourceUrl: httpUrl,
    sourcePublisher: z.string().trim().min(2).max(200),
    sourceTitle: z.string().trim().min(2).max(300),
    sourceAccessedAt: isoDay,
    sourceVerifiedAt: isoDay,
    sourceNotes: z.string().trim().max(600).nullable(),
    evidence: z.string().trim().min(10).max(1200),
  })
  .superRefine((record, ctx) => {
    if (
      record.nationalityScope === "LISTED" &&
      record.eligibleNationalities.length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["eligibleNationalities"],
        message: "LISTED nationality scope needs at least one country.",
      });
    }
    if (
      record.nationalityScope !== "LISTED" &&
      record.eligibleNationalities.length > 0
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["eligibleNationalities"],
        message: "Only LISTED nationality scope may name countries.",
      });
    }
    if (record.fieldScope === "LISTED" && record.fields.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["fields"],
        message: "LISTED field scope needs at least one field.",
      });
    }
    if (record.fieldScope !== "LISTED" && record.fields.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["fields"],
        message: "Only LISTED field scope may name fields.",
      });
    }
    if (/[<>]/.test(record.summary)) {
      ctx.addIssue({
        code: "custom",
        path: ["summary"],
        message: "Summary must be plain text without markup.",
      });
    }
  });

type ResearchRecord = z.infer<typeof researchRecordSchema>;
type LoadedRecord = ResearchRecord & { file: string };

type Report = {
  startedAt: string;
  dryRun: boolean;
  files: string[];
  datasetRecords: number;
  validRecords: number;
  created: number;
  skippedDuplicates: number;
  citationsCreated: number;
  reviewsCreated: number;
  errors: Array<{ file: string; record: number | null; message: string }>;
  duplicates: Array<{ name: string; providerName: string; file: string }>;
  records: Array<
    Pick<
      ResearchRecord,
      | "name"
      | "providerName"
      | "providerUrl"
      | "hostCountryCode"
      | "fundingType"
      | "degreeLevels"
      | "nationalityScope"
      | "eligibleNationalities"
      | "fieldScope"
      | "fields"
      | "summary"
      | "sourceUrl"
      | "sourcePublisher"
      | "sourceTitle"
      | "sourceAccessedAt"
      | "sourceVerifiedAt"
      | "sourceNotes"
      | "evidence"
    > & { slug: string; status: "VERIFIED" }
  >;
  countsBefore: Record<string, number>;
  countsAfter: Record<string, number>;
  finishedAt?: string;
};

const report: Report = {
  startedAt: new Date().toISOString(),
  dryRun: DRY_RUN,
  files: [],
  datasetRecords: 0,
  validRecords: 0,
  created: 0,
  skippedDuplicates: 0,
  citationsCreated: 0,
  reviewsCreated: 0,
  errors: [],
  duplicates: [],
  records: [],
  countsBefore: {},
  countsAfter: {},
};

function asDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function reviewDate(verifiedAt: string): Date {
  const date = asDate(verifiedAt);
  date.setUTCDate(date.getUTCDate() + REVIEW_INTERVAL_DAYS);
  return date;
}

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

function uniqueSlug(record: ResearchRecord, usedSlugs: Set<string>): string {
  const base = slugify(record.name) || slugify(record.providerName) || "award";
  const provider = slugify(record.providerName).slice(0, 28) || "provider";
  let candidate = base;
  let suffixIndex = 2;
  while (usedSlugs.has(candidate)) {
    candidate =
      suffixIndex === 2
        ? `${base.slice(0, 80)}-${provider}`
        : `${base.slice(0, 80)}-${provider}-${suffixIndex}`;
    suffixIndex += 1;
  }
  usedSlugs.add(candidate);
  return candidate;
}

function loadDatasets(): LoadedRecord[] {
  const files = fs
    .readdirSync(DATA_DIR)
    .filter(
      (file) =>
        /^scholarships-.+\.json$/.test(file) &&
        file !== path.basename(REPORT_PATH),
    )
    .sort();
  report.files = files;

  const records: LoadedRecord[] = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(DATA_DIR, file), "utf8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      report.errors.push({
        file,
        record: null,
        message: error instanceof Error ? error.message : "Invalid JSON.",
      });
      continue;
    }

    const dataset = z
      .object({ records: z.array(z.unknown()) })
      .safeParse(parsed);
    if (!dataset.success) {
      report.errors.push({
        file,
        record: null,
        message: "Expected an object with a records array.",
      });
      continue;
    }

    report.datasetRecords += dataset.data.records.length;
    dataset.data.records.forEach((value, index) => {
      const result = researchRecordSchema.safeParse(value);
      if (!result.success) {
        report.errors.push({
          file,
          record: index + 1,
          message: z.prettifyError(result.error),
        });
        return;
      }
      records.push({ ...result.data, file });
    });
  }
  return records;
}

async function counts(): Promise<Record<string, number>> {
  // PGlite serialises database work, so issue counts one at a time.
  const scholarships = await prisma.scholarship.count();
  const citations = await prisma.sourceCitation.count();
  const reviews = await prisma.catalogReview.count();
  const audits = await prisma.auditEvent.count();
  const requirements = await prisma.requirement.count();
  const deadlines = await prisma.deadlineFact.count();
  return {
    scholarships,
    citations,
    reviews,
    audits,
    requirements,
    deadlines,
  };
}

const citationCache = new Map<string, string>();

async function citationId(record: ResearchRecord): Promise<string> {
  const cached = citationCache.get(record.sourceUrl);
  if (cached) return cached;

  const row = await prisma.sourceCitation.upsert({
    where: { url: record.sourceUrl },
    create: {
      url: record.sourceUrl,
      publisher: record.sourcePublisher,
      title: record.sourceTitle,
      accessedAt: asDate(record.sourceAccessedAt),
      verifiedAt: asDate(record.sourceVerifiedAt),
      notes: record.sourceNotes ?? IMPORT_NOTE,
    },
    update: {
      publisher: record.sourcePublisher,
      title: record.sourceTitle,
      verifiedAt: asDate(record.sourceVerifiedAt),
    },
    select: { id: true },
  });
  citationCache.set(record.sourceUrl, row.id);
  report.citationsCreated += 1;
  return row.id;
}

async function main(): Promise<void> {
  const records = loadDatasets();
  report.validRecords = records.length;

  const existing = await prisma.scholarship.findMany({
    select: { slug: true, name: true, providerName: true },
  });
  const usedSlugs = new Set(existing.map((row) => row.slug));
  const seenKeys = new Set(existing.map(duplicateKey));
  const prepared: Array<{ record: ResearchRecord; slug: string }> = [];

  for (const record of records) {
    const key = duplicateKey(record);
    if (seenKeys.has(key)) {
      report.skippedDuplicates += 1;
      report.duplicates.push({
        name: record.name,
        providerName: record.providerName,
        file: record.file,
      });
      continue;
    }
    seenKeys.add(key);
    const slug = uniqueSlug(record, usedSlugs);
    prepared.push({ record, slug });
  }

  report.countsBefore = await counts();

  if (!DRY_RUN) {
    for (const { record, slug } of prepared) {
      const sourceId = await citationId(record);
      const saved = await prisma.scholarship.create({
        data: {
          slug,
          name: record.name,
          providerName: record.providerName,
          providerUrl: record.providerUrl,
          hostCountryCode: record.hostCountryCode,
          fundingType: record.fundingType,
          degreeLevels: record.degreeLevels,
          nationalityScope: record.nationalityScope,
          eligibleNationalities: record.eligibleNationalities,
          fieldScope: record.fieldScope,
          fields: record.fields,
          summary: record.summary,
          verificationStatus: "VERIFIED",
          featured: false,
          lastVerifiedAt: asDate(record.sourceVerifiedAt),
          nextReviewAt: reviewDate(record.sourceVerifiedAt),
          primarySourceId: sourceId,
        },
        select: { id: true },
      });

      await prisma.catalogReview.create({
        data: {
          entityType: "SCHOLARSHIP",
          entityId: saved.id,
          decision: "IMPORT",
          fromStatus: null,
          toStatus: "VERIFIED",
          note: IMPORT_NOTE,
        },
      });
      report.reviewsCreated += 1;

      await prisma.auditEvent.create({
        data: {
          actorId: null,
          action: "admin.scholarship_import",
          entityType: "SCHOLARSHIP",
          entityId: saved.id,
          metadata: {
            sourceUrl: record.sourceUrl,
            providerName: record.providerName,
            verificationStatus: "VERIFIED",
          },
        },
      });

      report.created += 1;
      report.records.push({
        slug,
        status: "VERIFIED",
        name: record.name,
        providerName: record.providerName,
        providerUrl: record.providerUrl,
        hostCountryCode: record.hostCountryCode,
        fundingType: record.fundingType,
        degreeLevels: record.degreeLevels,
        nationalityScope: record.nationalityScope,
        eligibleNationalities: record.eligibleNationalities,
        fieldScope: record.fieldScope,
        fields: record.fields,
        summary: record.summary,
        sourceUrl: record.sourceUrl,
        sourcePublisher: record.sourcePublisher,
        sourceTitle: record.sourceTitle,
        sourceAccessedAt: record.sourceAccessedAt,
        sourceVerifiedAt: record.sourceVerifiedAt,
        sourceNotes: record.sourceNotes,
        evidence: record.evidence,
      });
    }
  } else {
    for (const { record, slug } of prepared) {
      report.records.push({
        slug,
        status: "VERIFIED",
        name: record.name,
        providerName: record.providerName,
        providerUrl: record.providerUrl,
        hostCountryCode: record.hostCountryCode,
        fundingType: record.fundingType,
        degreeLevels: record.degreeLevels,
        nationalityScope: record.nationalityScope,
        eligibleNationalities: record.eligibleNationalities,
        fieldScope: record.fieldScope,
        fields: record.fields,
        summary: record.summary,
        sourceUrl: record.sourceUrl,
        sourcePublisher: record.sourcePublisher,
        sourceTitle: record.sourceTitle,
        sourceAccessedAt: record.sourceAccessedAt,
        sourceVerifiedAt: record.sourceVerifiedAt,
        sourceNotes: record.sourceNotes,
        evidence: record.evidence,
      });
    }
  }

  report.countsAfter = await counts();
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  if (report.errors.length > 0) {
    throw new Error(
      `${report.errors.length} dataset error(s). See ${path.relative(ROOT, REPORT_PATH)}.`,
    );
  }

  console.log(
    `${DRY_RUN ? "Validated" : "Imported"} ${prepared.length} scholarship record(s); ` +
      `${report.skippedDuplicates} duplicate(s) skipped, ` +
      `${report.errors.length} error(s). Report: ${path.relative(ROOT, REPORT_PATH)}`,
  );
}

main()
  .catch((error) => {
    console.error("[scholarship-import] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
