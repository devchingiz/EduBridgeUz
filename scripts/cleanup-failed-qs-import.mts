/**
 * Recovery utility for the first QS import attempt.
 *
 * That attempt created a duplicate "The University of Manchester" record
 * because the hand-verified seed uses the legacy slug without "the-". The
 * importer now matches both slugs. This script removes only that duplicate and
 * refuses to run if any user-owned data is attached to it.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const duplicateSlug = "the-university-of-manchester";
const seedSlug = "university-of-manchester";

const [duplicate, seed] = await Promise.all([
  prisma.university.findUnique({ where: { slug: duplicateSlug } }),
  prisma.university.findUnique({ where: { slug: seedSlug } }),
]);

if (!duplicate || !seed) {
  console.log("No duplicate QS import record to clean up.");
} else {
  const [programs, facts, favorites, applications, notes] = await Promise.all([
    prisma.program.count({ where: { universityId: duplicate.id } }),
    prisma.catalogFieldFact.count({ where: { universityId: duplicate.id } }),
    prisma.universityFavorite.count({ where: { universityId: duplicate.id } }),
    prisma.application.count({ where: { universityId: duplicate.id } }),
    prisma.studyNote.count({ where: { universityId: duplicate.id } }),
  ]);
  const attached = programs + facts + favorites + applications + notes;
  if (attached > 0) {
    throw new Error(
      `Refusing to remove ${duplicateSlug}: ${attached} attached catalog/user records found.`,
    );
  }

  await prisma.$transaction([
    prisma.catalogReview.deleteMany({
      where: { entityType: "UNIVERSITY", entityId: duplicate.id },
    }),
    prisma.auditEvent.deleteMany({
      where: { entityType: "UNIVERSITY", entityId: duplicate.id },
    }),
    prisma.university.delete({ where: { id: duplicate.id } }),
    prisma.auditEvent.create({
      data: {
        action: "catalog.cleanup_duplicate_qs_import",
        entityType: "UNIVERSITY",
        entityId: seed.id,
        metadata: {
          removedSlug: duplicateSlug,
          keptSlug: seedSlug,
          reason: "Legacy seed slug alias now handled by the importer.",
        },
      },
    }),
  ]);
  console.log(`Removed duplicate ${duplicateSlug}; kept ${seedSlug}.`);
}

console.log(`Database universities: ${await prisma.university.count()}`);
await prisma.$disconnect();
