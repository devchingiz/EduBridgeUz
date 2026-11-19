/**
 * Imports the cached QS 2027 research dataset into EduBridge.
 *
 * This script makes NO network calls. It reads `data/qs-2027-universities.json`,
 * validates it, upserts source citations/universities/programs/field facts, and
 * writes `data/qs-2027-import-report.json`. Existing hand-verified universities
 * are never downgraded: their official values and VERIFIED status are kept, and
 * only genuinely new QS ranking facts are attached.
 *
 * Run with `npm run db:import:qs` while the local database is running.
 */

import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

import {
  degreeLevel,
  durationMonths,
  feeCurrency,
  isHttpUrl,
  legacySeedSlug,
  programmeField,
  slugify,
  validateQsDataset,
} from "../src/lib/catalog/qs-import-mapping.ts";

const prisma = new PrismaClient();
const DATASET_PATH = new URL(
  "../data/qs-2027-universities.json",
  import.meta.url,
);
const REPORT_PATH = new URL(
  "../data/qs-2027-import-report.json",
  import.meta.url,
);
const EXPECTED_COUNT = 500;
const REVIEW_WINDOW_DAYS = 180;
const IMPORT_NOTE =
  "Imported from the QS World University Rankings 2027 research dataset.";

type FieldStatus =
  | "VERIFIED"
  | "PARTIALLY_VERIFIED"
  | "NOT_VERIFIED"
  | "INFORMATION_UNAVAILABLE";
type EntityType = "UNIVERSITY" | "PROGRAM";

type QsProgram = {
  name: string;
  degree: string | null;
  studyLevel: string | null;
  duration: string | null;
  fee: string | null;
  scholarships: string | null;
  sourceUrl: string;
};

type QsUniversity = {
  qsNid: number;
  name: string;
  slug: string;
  country: string;
  countryCode: string;
  city: string | null;
  continent: string | null;
  qsSourceUrl: string;
  qsProfilePath: string;
  logoUrl: string | null;
  description: string | null;
  institutionType: string | null;
  scholarshipAvailable: boolean | null;
  internationalTuitionIndicative: string | null;
  qsProgrammeCount: number | null;
  rankDisplay: string;
  rankPosition: number;
  rankTied: boolean;
  rankIsRange: boolean;
  rankingOrganization: string;
  rankingEdition: string;
  officialWebsiteUrl?: string | null;
  officialWebsiteSourceUrl?: string | null;
  wikipediaUrl?: string | null;
  wikidataId?: string | null;
  programs: QsProgram[];
  subjectTags: string[];
};

type Dataset = {
  meta: {
    retrievedAt: string;
    rankingEdition: string;
    rankingPublished: string;
    recordCount: number;
    primarySourceUrl: string;
  };
  universities: QsUniversity[];
};

type FactOptions = {
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  verifiedAt?: string | null;
  academicYear?: string | null;
  intake?: string | null;
  currency?: string | null;
  unit?: string | null;
  note?: string | null;
};

const report = {
  startedAt: new Date().toISOString(),
  datasetRecords: 0,
  createdUniversities: 0,
  updatedUniversities: 0,
  keptVerifiedUniversities: 0,
  createdPrograms: 0,
  updatedPrograms: 0,
  skippedPrograms: 0,
  citations: 0,
  fieldFacts: 0,
  errors: [] as Array<{ name: string; message: string }>,
  warnings: [] as string[],
};

function asDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function reviewDate(verifiedAt: string): Date {
  const date = asDate(verifiedAt);
  date.setUTCDate(date.getUTCDate() + REVIEW_WINDOW_DAYS);
  return date;
}

const citationCache = new Map<string, string>();

async function citationId(input: {
  url: string;
  publisher: string;
  title: string;
  verifiedAt: string;
  notes?: string | null;
}): Promise<string> {
  const cached = citationCache.get(input.url);
  if (cached) return cached;
  const row = await prisma.sourceCitation.upsert({
    where: { url: input.url },
    create: {
      url: input.url,
      publisher: input.publisher,
      title: input.title,
      accessedAt: asDate(input.verifiedAt),
      verifiedAt: asDate(input.verifiedAt),
      notes: input.notes ?? null,
    },
    update: {
      publisher: input.publisher,
      title: input.title,
      verifiedAt: asDate(input.verifiedAt),
      notes: input.notes ?? null,
    },
    select: { id: true },
  });
  citationCache.set(input.url, row.id);
  report.citations += 1;
  return row.id;
}

async function fieldFact(
  entityType: EntityType,
  entityId: string,
  fieldKey: string,
  label: string,
  value: string | null,
  status: FieldStatus,
  options: FactOptions = {},
): Promise<void> {
  // University facts are also linked by a typed relation so detail queries can
  // include them directly. Other entity types use only the generic pair.
  const universityId = entityType === "UNIVERSITY" ? entityId : null;
  let sourceId: string | null = null;
  let sourceUrl: string | null = options.sourceUrl ?? null;
  let sourceTitle: string | null = options.sourceTitle ?? null;
  if (options.sourceUrl && isHttpUrl(options.sourceUrl)) {
    sourceId = await citationId({
      url: options.sourceUrl,
      publisher: "QS TopUniversities",
      title: options.sourceTitle ?? `Source for ${label}: ${entityId}`,
      verifiedAt: options.verifiedAt ?? "2026-11-19",
    });
    const source = await prisma.sourceCitation.findUnique({
      where: { id: sourceId },
      select: { url: true, title: true },
    });
    sourceUrl = source?.url ?? sourceUrl;
    sourceTitle = source?.title ?? sourceTitle;
  } else {
    sourceUrl = null;
    sourceTitle = null;
  }

  await prisma.catalogFieldFact.upsert({
    where: {
      entityType_entityId_fieldKey: { entityType, entityId, fieldKey },
    },
    create: {
      entityType,
      entityId,
      universityId,
      fieldKey,
      label,
      value,
      status,
      sourceId,
      sourceUrl,
      sourceTitle,
      verifiedAt: options.verifiedAt ? asDate(options.verifiedAt) : null,
      academicYear: options.academicYear ?? null,
      intake: options.intake ?? null,
      currency: options.currency ?? null,
      unit: options.unit ?? null,
      note: options.note ?? null,
    },
    update: {
      universityId,
      label,
      value,
      status,
      sourceId,
      sourceUrl,
      sourceTitle,
      verifiedAt: options.verifiedAt ? asDate(options.verifiedAt) : null,
      academicYear: options.academicYear ?? null,
      intake: options.intake ?? null,
      currency: options.currency ?? null,
      unit: options.unit ?? null,
      note: options.note ?? null,
    },
  });
  report.fieldFacts += 1;
}

async function recordImport(
  entityType: EntityType,
  entityId: string,
): Promise<void> {
  const existing = await prisma.catalogReview.findFirst({
    where: { entityType, entityId, decision: "IMPORT", note: IMPORT_NOTE },
    select: { id: true },
  });
  if (existing) return;
  await prisma.catalogReview.create({
    data: {
      entityType,
      entityId,
      decision: "IMPORT",
      fromStatus: null,
      toStatus: "PARTIALLY_VERIFIED",
      note: IMPORT_NOTE,
    },
  });
}

async function importUniversity(
  university: QsUniversity,
  meta: Dataset["meta"],
): Promise<void> {
  const qsSourceId = await citationId({
    url: university.qsSourceUrl,
    publisher: "QS TopUniversities",
    title: `QS profile: ${university.name}`,
    verifiedAt: meta.retrievedAt,
    notes: "Public QS institution profile index.",
  });
  const rankingSourceId = await citationId({
    url: meta.primarySourceUrl,
    publisher: "QS TopUniversities",
    title: meta.rankingEdition,
    verifiedAt: meta.rankingPublished,
    notes: `Published ${meta.rankingPublished}; ties preserved from QS.`,
  });
  if (university.officialWebsiteUrl) {
    await citationId({
      url: university.officialWebsiteSourceUrl ?? university.officialWebsiteUrl,
      publisher: "Wikidata",
      title: `Official website claim (P856) for ${university.name}`,
      verifiedAt: meta.retrievedAt,
      notes: `Official website: ${university.officialWebsiteUrl}`,
    });
  }

  // The hand-verified seed used "University of Manchester" while QS publishes
  // "The University of Manchester". Matching the historical slug prevents a
  // duplicate and keeps the catalog at exactly 500 distinct institutions.
  const legacySlug = legacySeedSlug(university.slug);
  const existing = await prisma.university.findFirst({
    where: {
      OR: [
        { slug: university.slug },
        ...(legacySlug !== university.slug ? [{ slug: legacySlug }] : []),
        { qsNid: university.qsNid },
      ],
    },
    select: { id: true, verificationStatus: true },
  });
  const keepVerified = existing?.verificationStatus === "VERIFIED";

  const rankingFields = {
    // QS is the primary source for the official institutional name, even when
    // an existing hand-verified record is preserved.
    name: university.name,
    continent: university.continent,
    rankingOrganization: university.rankingOrganization,
    rankingEdition: university.rankingEdition,
    rankingPosition: university.rankPosition,
    rankingDisplay: university.rankDisplay,
    rankingTied: university.rankTied,
    rankingIsRange: university.rankIsRange,
    qsNid: university.qsNid,
    rankingSourceId,
  };

  const record = existing
    ? await prisma.university.update({
        where: { id: existing.id },
        data: keepVerified
          ? rankingFields
          : {
              ...rankingFields,
              slug: university.slug,
              name: university.name,
              city: university.city ?? "Information unavailable",
              countryCode: university.countryCode,
              websiteUrl: university.officialWebsiteUrl ?? null,
              institutionType: university.institutionType,
              logoUrl: university.logoUrl,
              description: university.description,
              verificationStatus: "PARTIALLY_VERIFIED",
              lastVerifiedAt: asDate(meta.retrievedAt),
              nextReviewAt: reviewDate(meta.retrievedAt),
              primarySourceId: qsSourceId,
            },
      })
    : await prisma.university.create({
        data: {
          ...rankingFields,
          slug: university.slug,
          name: university.name,
          city: university.city ?? "Information unavailable",
          countryCode: university.countryCode,
          websiteUrl: university.officialWebsiteUrl ?? null,
          institutionType: university.institutionType,
          logoUrl: university.logoUrl,
          description: university.description,
          verificationStatus: "PARTIALLY_VERIFIED",
          lastVerifiedAt: asDate(meta.retrievedAt),
          nextReviewAt: reviewDate(meta.retrievedAt),
          primarySourceId: qsSourceId,
        },
      });

  if (existing) report.updatedUniversities += 1;
  else report.createdUniversities += 1;
  if (keepVerified) report.keptVerifiedUniversities += 1;

  const source = {
    sourceUrl: university.qsSourceUrl,
    sourceTitle: `QS profile: ${university.name}`,
    verifiedAt: meta.retrievedAt,
  };

  if (!keepVerified) {
    await fieldFact(
      "UNIVERSITY",
      record.id,
      "name",
      "Institution name",
      university.name,
      "PARTIALLY_VERIFIED",
      source,
    );
    await fieldFact(
      "UNIVERSITY",
      record.id,
      "country",
      "Country",
      university.country,
      "PARTIALLY_VERIFIED",
      source,
    );
    await fieldFact(
      "UNIVERSITY",
      record.id,
      "city",
      "City",
      university.city,
      university.city ? "PARTIALLY_VERIFIED" : "INFORMATION_UNAVAILABLE",
      source,
    );
    await fieldFact(
      "UNIVERSITY",
      record.id,
      "institution_type",
      "Institution type",
      university.institutionType,
      university.institutionType
        ? "PARTIALLY_VERIFIED"
        : "INFORMATION_UNAVAILABLE",
      source,
    );
    await fieldFact(
      "UNIVERSITY",
      record.id,
      "description",
      "Profile description",
      university.description,
      university.description ? "PARTIALLY_VERIFIED" : "INFORMATION_UNAVAILABLE",
      source,
    );
    await fieldFact(
      "UNIVERSITY",
      record.id,
      "logo",
      "Logo",
      university.logoUrl,
      university.logoUrl ? "PARTIALLY_VERIFIED" : "INFORMATION_UNAVAILABLE",
      source,
    );
    await fieldFact(
      "UNIVERSITY",
      record.id,
      "official_website",
      "Official website",
      university.officialWebsiteUrl ?? null,
      university.officialWebsiteUrl
        ? "PARTIALLY_VERIFIED"
        : "INFORMATION_UNAVAILABLE",
      university.officialWebsiteUrl
        ? {
            sourceUrl:
              university.officialWebsiteSourceUrl ??
              university.officialWebsiteUrl,
            sourceTitle: `Wikidata P856 claim for ${university.name}`,
            verifiedAt: meta.retrievedAt,
          }
        : { note: "No confident Wikidata P856 claim was available." },
    );
    await fieldFact(
      "UNIVERSITY",
      record.id,
      "scholarship_availability",
      "Scholarships listed on QS",
      university.scholarshipAvailable === null
        ? null
        : university.scholarshipAvailable
          ? "Yes"
          : "No",
      university.scholarshipAvailable === null
        ? "INFORMATION_UNAVAILABLE"
        : "PARTIALLY_VERIFIED",
      source,
    );
    await fieldFact(
      "UNIVERSITY",
      record.id,
      "indicative_international_tuition",
      "Indicative international tuition",
      university.internationalTuitionIndicative,
      university.internationalTuitionIndicative
        ? "PARTIALLY_VERIFIED"
        : "INFORMATION_UNAVAILABLE",
      {
        ...source,
        note: "QS indicative profile value, not an official university fee sheet.",
      },
    );
    await fieldFact(
      "UNIVERSITY",
      record.id,
      "programs_listed",
      "Programmes in QS index",
      String(university.qsProgrammeCount ?? university.programs.length),
      "PARTIALLY_VERIFIED",
      source,
    );
  }

  await fieldFact(
    "UNIVERSITY",
    record.id,
    "qs_ranking_2027",
    "QS World University Rankings 2027",
    university.rankDisplay,
    "PARTIALLY_VERIFIED",
    {
      sourceUrl: meta.primarySourceUrl,
      sourceTitle: meta.rankingEdition,
      verifiedAt: meta.rankingPublished,
      academicYear: "2027",
      note: university.rankTied ? 'QS tie marker "=" is preserved.' : null,
    },
  );
  await fieldFact(
    "UNIVERSITY",
    record.id,
    "ranking_edition",
    "Ranking edition",
    university.rankingEdition,
    "PARTIALLY_VERIFIED",
    {
      sourceUrl: meta.primarySourceUrl,
      sourceTitle: meta.rankingEdition,
      verifiedAt: meta.rankingPublished,
      academicYear: "2027",
    },
  );
  await fieldFact(
    "UNIVERSITY",
    record.id,
    "continent",
    "Continent",
    university.continent,
    university.continent ? "PARTIALLY_VERIFIED" : "INFORMATION_UNAVAILABLE",
    {
      ...source,
      note: "Derived from the QS campus country using EduBridge's published country-to-continent mapping.",
    },
  );

  const unavailableFields: Array<[string, string, string]> = [
    [
      "admission_requirements",
      "Admission requirements",
      "The QS institution index does not publish entry requirements.",
    ],
    [
      "english_language_requirements",
      "English-language requirements",
      "IELTS/TOEFL minima are not available in the QS institution index.",
    ],
    [
      "application_deadlines",
      "Application deadlines",
      "The QS institution index does not publish application deadlines.",
    ],
    [
      "intake",
      "Intake terms",
      "Intake months are not available in the QS institution index.",
    ],
    [
      "founded_year",
      "Founded year",
      "Founded year is not available in the QS institution index.",
    ],
    [
      "contact_details",
      "Contact details",
      "Contact email, phone and postal address are not available in the QS institution index.",
    ],
    [
      "scholarship_awards",
      "Individual scholarship awards",
      "Individual award amounts are not available in the QS institution index.",
    ],
    [
      "english_taught_options",
      "English-taught options",
      "Language of instruction is not guaranteed by the QS institution index.",
    ],
  ];
  for (const [key, label, note] of unavailableFields) {
    await fieldFact(
      "UNIVERSITY",
      record.id,
      key,
      label,
      null,
      "INFORMATION_UNAVAILABLE",
      { note },
    );
  }

  if (!keepVerified) {
    await importPrograms(university, record.id, meta);
  } else {
    report.skippedPrograms += university.programs.length;
    report.warnings.push(
      `Kept hand-verified programs for ${university.name}; skipped ${university.programs.length} QS programme rows.`,
    );
  }

  await recordImport("UNIVERSITY", record.id);
  await prisma.auditEvent.create({
    data: {
      action: "catalog.import_qs_university",
      entityType: "UNIVERSITY",
      entityId: record.id,
      metadata: {
        qsNid: university.qsNid,
        rank: university.rankDisplay,
        countryCode: university.countryCode,
        name: university.name,
      },
    },
  });
}

async function importPrograms(
  university: QsUniversity,
  universityId: string,
  meta: Dataset["meta"],
): Promise<void> {
  const usedSlugs = new Set<string>();
  for (const program of university.programs) {
    const level = degreeLevel(program);
    if (!level) {
      report.skippedPrograms += 1;
      report.warnings.push(
        `Skipped ${program.name} at ${university.name}: degree level unavailable.`,
      );
      continue;
    }
    if (!isHttpUrl(program.sourceUrl)) {
      report.skippedPrograms += 1;
      report.warnings.push(
        `Skipped ${program.name} at ${university.name}: invalid source URL.`,
      );
      continue;
    }

    let slug = slugify(program.name) || "program";
    let suffix = 2;
    while (usedSlugs.has(slug)) {
      slug = `${slugify(program.name) || "program"}-${suffix}`;
      suffix += 1;
    }
    usedSlugs.add(slug);

    const sourceId = await citationId({
      url: program.sourceUrl,
      publisher: "QS TopUniversities",
      title: `QS programme: ${program.name}`,
      verifiedAt: meta.retrievedAt,
      notes: "Public QS programme index.",
    });

    const existing = await prisma.program.findUnique({
      where: { universityId_slug: { universityId, slug } },
      select: { id: true },
    });
    const data = {
      name: program.name,
      degreeLevel: level,
      field: programmeField(program.name),
      language: null,
      durationMonths: durationMonths(program.duration),
      credits: null,
      startMonths: [] as number[],
      startNote: "Intake months are not published in the QS programme index.",
      verificationStatus: "PARTIALLY_VERIFIED" as const,
      lastVerifiedAt: asDate(meta.retrievedAt),
      nextReviewAt: reviewDate(meta.retrievedAt),
      primarySourceId: sourceId,
    };
    const record = existing
      ? await prisma.program.update({ where: { id: existing.id }, data })
      : await prisma.program.create({
          data: { ...data, universityId, slug },
        });
    if (existing) report.updatedPrograms += 1;
    else report.createdPrograms += 1;

    const source = {
      sourceUrl: program.sourceUrl,
      sourceTitle: `QS programme: ${program.name}`,
      verifiedAt: meta.retrievedAt,
    };
    await fieldFact(
      "PROGRAM",
      record.id,
      "name",
      "Programme name",
      program.name,
      "PARTIALLY_VERIFIED",
      source,
    );
    await fieldFact(
      "PROGRAM",
      record.id,
      "degree_level",
      "Degree level",
      level,
      "PARTIALLY_VERIFIED",
      source,
    );
    await fieldFact(
      "PROGRAM",
      record.id,
      "field",
      "Field",
      data.field,
      "PARTIALLY_VERIFIED",
      {
        ...source,
        note:
          data.field === "Not classified"
            ? "QS did not publish a field classification."
            : null,
      },
    );
    await fieldFact(
      "PROGRAM",
      record.id,
      "duration",
      "Duration",
      program.duration,
      program.duration ? "PARTIALLY_VERIFIED" : "INFORMATION_UNAVAILABLE",
      source,
    );
    await fieldFact(
      "PROGRAM",
      record.id,
      "indicative_fee",
      "Indicative fee",
      program.fee,
      program.fee ? "PARTIALLY_VERIFIED" : "INFORMATION_UNAVAILABLE",
      {
        ...source,
        currency: feeCurrency(program.fee),
        note: "QS indicative profile value, not an official university fee sheet.",
      },
    );
    await fieldFact(
      "PROGRAM",
      record.id,
      "language",
      "Language of instruction",
      null,
      "INFORMATION_UNAVAILABLE",
      source,
    );
    await fieldFact(
      "PROGRAM",
      record.id,
      "requirements",
      "Entry requirements",
      null,
      "INFORMATION_UNAVAILABLE",
      source,
    );
    await fieldFact(
      "PROGRAM",
      record.id,
      "deadlines",
      "Application deadlines",
      null,
      "INFORMATION_UNAVAILABLE",
      source,
    );
    await fieldFact(
      "PROGRAM",
      record.id,
      "intake",
      "Intake terms",
      null,
      "INFORMATION_UNAVAILABLE",
      source,
    );
    await fieldFact(
      "PROGRAM",
      record.id,
      "credits",
      "Credits",
      null,
      "INFORMATION_UNAVAILABLE",
      source,
    );
  }
}

async function main(): Promise<void> {
  const raw = fs.readFileSync(DATASET_PATH, "utf8");
  const dataset = JSON.parse(raw) as Dataset;
  validateQsDataset(dataset, EXPECTED_COUNT);
  report.datasetRecords = dataset.universities.length;

  for (const university of dataset.universities) {
    try {
      await importUniversity(university, dataset.meta);
    } catch (error) {
      report.errors.push({
        name: university.name,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));

  const dbCount = await prisma.university.count();
  console.log(`Database universities: ${dbCount}`);
  if (report.errors.length > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
