/**
 * Seeds the hand-verified catalog.
 *
 * Run with `npm run db:seed` while the local database is running. The script is
 * idempotent: records are upserted by slug, and an entity's facts are replaced
 * with the verified set on every run. It never invents a value; everything comes
 * from `src/lib/catalog/seed-data.ts`.
 *
 * Node runs this file directly with native type stripping, so it deliberately
 * uses no path aliases and imports the data module with its `.ts` extension.
 */

import { PrismaClient } from "@prisma/client";

import {
  seedCitations,
  seedScholarships,
  seedUniversities,
  type CitationKey,
} from "../src/lib/catalog/seed-data.ts";

const prisma = new PrismaClient();
const REVIEW_WINDOW_DAYS = 180;

function asDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function reviewDate(verifiedAt: string): Date {
  const date = asDate(verifiedAt);
  date.setUTCDate(date.getUTCDate() + REVIEW_WINDOW_DAYS);
  return date;
}

const citationCache = new Map<CitationKey, string>();

async function citationId(key: CitationKey): Promise<string> {
  const cached = citationCache.get(key);
  if (cached) return cached;

  const citation = seedCitations[key];
  const row = await prisma.sourceCitation.upsert({
    where: { url: citation.url },
    create: {
      url: citation.url,
      publisher: citation.publisher,
      title: citation.title,
      accessedAt: asDate(citation.accessedAt),
      verifiedAt: asDate(citation.verifiedAt),
      notes: citation.notes ?? null,
    },
    update: {
      publisher: citation.publisher,
      title: citation.title,
      accessedAt: asDate(citation.accessedAt),
      verifiedAt: asDate(citation.verifiedAt),
      notes: citation.notes ?? null,
    },
    select: { id: true },
  });

  citationCache.set(key, row.id);
  return row.id;
}

async function recordImport(
  entityType: "UNIVERSITY" | "PROGRAM" | "SCHOLARSHIP",
  entityId: string,
  sourceId: string,
): Promise<void> {
  const existing = await prisma.catalogReview.findFirst({
    where: { entityType, entityId },
    select: { id: true },
  });
  if (existing) return;

  const source = await prisma.sourceCitation.findUnique({
    where: { id: sourceId },
    select: { verifiedAt: true },
  });
  if (!source?.verifiedAt) return;

  await prisma.catalogReview.create({
    data: {
      entityType,
      entityId,
      decision: "IMPORT",
      fromStatus: null,
      toStatus: "VERIFIED",
      note: "Seeded from a hand-verified official source.",
    },
  });
}

async function seedUniversity(university: (typeof seedUniversities)[number]) {
  const primarySourceId = await citationId(university.source);
  const citation = seedCitations[university.source];

  const record = await prisma.university.upsert({
    where: { slug: university.slug },
    create: {
      slug: university.slug,
      name: university.name,
      shortName: university.shortName,
      city: university.city,
      countryCode: university.countryCode,
      websiteUrl: university.websiteUrl,
      verificationStatus: "VERIFIED",
      lastVerifiedAt: asDate(citation.verifiedAt),
      nextReviewAt: reviewDate(citation.verifiedAt),
      primarySourceId,
    },
    update: {
      name: university.name,
      shortName: university.shortName,
      city: university.city,
      countryCode: university.countryCode,
      websiteUrl: university.websiteUrl,
      verificationStatus: "VERIFIED",
      lastVerifiedAt: asDate(citation.verifiedAt),
      nextReviewAt: reviewDate(citation.verifiedAt),
      primarySourceId,
    },
    select: { id: true },
  });

  await recordImport("UNIVERSITY", record.id, primarySourceId);

  for (const program of university.programs) {
    const programSourceId = await citationId(program.source);
    const programCitation = seedCitations[program.source];

    const saved = await prisma.program.upsert({
      where: {
        universityId_slug: {
          universityId: record.id,
          slug: program.slug,
        },
      },
      create: {
        universityId: record.id,
        slug: program.slug,
        name: program.name,
        degreeLevel: program.degreeLevel,
        field: program.field,
        language: program.language,
        durationMonths: program.durationMonths,
        credits: program.credits,
        startNote: program.startNote,
        verificationStatus: "VERIFIED",
        lastVerifiedAt: asDate(programCitation.verifiedAt),
        nextReviewAt: reviewDate(programCitation.verifiedAt),
        primarySourceId: programSourceId,
      },
      update: {
        name: program.name,
        degreeLevel: program.degreeLevel,
        field: program.field,
        language: program.language,
        durationMonths: program.durationMonths,
        credits: program.credits,
        startNote: program.startNote,
        verificationStatus: "VERIFIED",
        lastVerifiedAt: asDate(programCitation.verifiedAt),
        nextReviewAt: reviewDate(programCitation.verifiedAt),
        primarySourceId: programSourceId,
      },
      select: { id: true },
    });

    await prisma.requirement.deleteMany({ where: { programId: saved.id } });
    await prisma.tuitionFact.deleteMany({ where: { programId: saved.id } });
    await prisma.deadlineFact.deleteMany({ where: { programId: saved.id } });
    await prisma.programIntake.deleteMany({ where: { programId: saved.id } });

    for (const fact of program.requirements) {
      await prisma.requirement.create({
        data: {
          programId: saved.id,
          kind: fact.kind,
          summary: fact.summary,
          verificationStatus: "VERIFIED",
          sourceId: await citationId(fact.source ?? program.source),
        },
      });
    }

    for (const fact of program.tuition) {
      await prisma.tuitionFact.create({
        data: {
          programId: saved.id,
          amountMinor: fact.amountMinor,
          currency: fact.currency,
          period: fact.period,
          applicantGroup: fact.applicantGroup,
          note: fact.note,
          verificationStatus: "VERIFIED",
          sourceId: await citationId(fact.source ?? program.source),
        },
      });
    }

    for (const fact of program.deadlines) {
      await prisma.deadlineFact.create({
        data: {
          programId: saved.id,
          cycle: fact.cycle,
          applicantGroup: fact.applicantGroup,
          opensOn: fact.opensOn ? asDate(fact.opensOn) : null,
          deadlineOn: fact.deadlineOn ? asDate(fact.deadlineOn) : null,
          opensMonthDay: fact.opensMonthDay ?? null,
          deadlineMonthDay: fact.deadlineMonthDay ?? null,
          note: fact.note,
          verificationStatus: "VERIFIED",
          sourceId: await citationId(fact.source ?? program.source),
        },
      });
    }

    for (const intake of program.intakes ?? []) {
      await prisma.programIntake.create({
        data: {
          programId: saved.id,
          term: intake.term,
          note: intake.note ?? null,
          verificationStatus: "VERIFIED",
          sourceId: await citationId(intake.source ?? program.source),
        },
      });
    }

    await recordImport("PROGRAM", saved.id, programSourceId);
  }
}

async function seedScholarship(scholarship: (typeof seedScholarships)[number]) {
  const primarySourceId = await citationId(scholarship.source);
  const citation = seedCitations[scholarship.source];

  const record = await prisma.scholarship.upsert({
    where: { slug: scholarship.slug },
    create: {
      slug: scholarship.slug,
      name: scholarship.name,
      providerName: scholarship.providerName,
      providerUrl: scholarship.providerUrl,
      hostCountryCode: scholarship.hostCountryCode,
      fundingType: scholarship.fundingType,
      degreeLevels: scholarship.degreeLevels,
      nationalityScope: scholarship.nationalityScope,
      eligibleNationalities: scholarship.eligibleNationalities,
      fieldScope: scholarship.fieldScope,
      fields: scholarship.fields,
      summary: scholarship.summary,
      verificationStatus: "VERIFIED",
      lastVerifiedAt: asDate(citation.verifiedAt),
      nextReviewAt: reviewDate(citation.verifiedAt),
      primarySourceId,
    },
    update: {
      name: scholarship.name,
      providerName: scholarship.providerName,
      providerUrl: scholarship.providerUrl,
      hostCountryCode: scholarship.hostCountryCode,
      fundingType: scholarship.fundingType,
      degreeLevels: scholarship.degreeLevels,
      nationalityScope: scholarship.nationalityScope,
      eligibleNationalities: scholarship.eligibleNationalities,
      fieldScope: scholarship.fieldScope,
      fields: scholarship.fields,
      summary: scholarship.summary,
      verificationStatus: "VERIFIED",
      lastVerifiedAt: asDate(citation.verifiedAt),
      nextReviewAt: reviewDate(citation.verifiedAt),
      primarySourceId,
    },
    select: { id: true },
  });

  await prisma.requirement.deleteMany({ where: { scholarshipId: record.id } });
  await prisma.deadlineFact.deleteMany({ where: { scholarshipId: record.id } });

  for (const fact of scholarship.requirements) {
    await prisma.requirement.create({
      data: {
        scholarshipId: record.id,
        kind: fact.kind,
        summary: fact.summary,
        verificationStatus: "VERIFIED",
        sourceId: await citationId(fact.source ?? scholarship.source),
      },
    });
  }

  for (const fact of scholarship.deadlines) {
    await prisma.deadlineFact.create({
      data: {
        scholarshipId: record.id,
        cycle: fact.cycle,
        applicantGroup: fact.applicantGroup,
        opensOn: fact.opensOn ? asDate(fact.opensOn) : null,
        deadlineOn: fact.deadlineOn ? asDate(fact.deadlineOn) : null,
        opensMonthDay: fact.opensMonthDay ?? null,
        deadlineMonthDay: fact.deadlineMonthDay ?? null,
        note: fact.note,
        verificationStatus: "VERIFIED",
        sourceId: await citationId(fact.source ?? scholarship.source),
      },
    });
  }

  await recordImport("SCHOLARSHIP", record.id, primarySourceId);
}

async function main() {
  for (const university of seedUniversities) {
    await seedUniversity(university);
  }
  for (const scholarship of seedScholarships) {
    await seedScholarship(scholarship);
  }

  const [universities, programs, scholarships, facts] = await Promise.all([
    prisma.university.count(),
    prisma.program.count(),
    prisma.scholarship.count(),
    prisma.requirement.count(),
  ]);

  console.log(
    `Seeded ${universities} universities, ${programs} programs, ${scholarships} scholarships, ${facts} requirement facts.`,
  );
}

main()
  .catch((error) => {
    console.error("[seed] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
