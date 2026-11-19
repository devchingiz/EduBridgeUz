/**
 * Expiry sweep for the public catalog.
 *
 * Records whose review window has passed move from VERIFIED to NEEDS_REVIEW and
 * stay visible with a warning banner. The sweep never deletes a record and never
 * changes a fact value. Every change is written to `CatalogReview` and the audit
 * trail so the public state can be explained later.
 *
 * Run with `npm run catalog:expire` (schedule daily in production).
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function today(): Date {
  const now = new Date();
  return new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

async function main() {
  const staleWhere = {
    verificationStatus: "VERIFIED" as const,
    nextReviewAt: { lt: today() },
  };

  const [universities, programs, scholarships] = await Promise.all([
    prisma.university.findMany({
      where: staleWhere,
      select: { id: true, nextReviewAt: true },
    }),
    prisma.program.findMany({
      where: staleWhere,
      select: { id: true, nextReviewAt: true },
    }),
    prisma.scholarship.findMany({
      where: staleWhere,
      select: { id: true, nextReviewAt: true },
    }),
  ]);

  const targets = [
    ...universities.map((row) => ({ type: "UNIVERSITY" as const, ...row })),
    ...programs.map((row) => ({ type: "PROGRAM" as const, ...row })),
    ...scholarships.map((row) => ({ type: "SCHOLARSHIP" as const, ...row })),
  ];

  for (const target of targets) {
    const note = target.nextReviewAt
      ? `Review window ended on ${target.nextReviewAt.toISOString().slice(0, 10)}.`
      : "Review window ended.";

    if (target.type === "UNIVERSITY") {
      await prisma.university.update({
        where: { id: target.id },
        data: { verificationStatus: "NEEDS_REVIEW" },
      });
    } else if (target.type === "PROGRAM") {
      await prisma.program.update({
        where: { id: target.id },
        data: { verificationStatus: "NEEDS_REVIEW" },
      });
    } else {
      await prisma.scholarship.update({
        where: { id: target.id },
        data: { verificationStatus: "NEEDS_REVIEW" },
      });
    }

    await prisma.catalogReview.create({
      data: {
        entityType: target.type,
        entityId: target.id,
        decision: "FLAG_STALE",
        fromStatus: "VERIFIED",
        toStatus: "NEEDS_REVIEW",
        note,
      },
    });

    await prisma.auditEvent.create({
      data: {
        action: "catalog.flag_stale",
        entityType: target.type,
        entityId: target.id,
        metadata: { note },
      },
    });
  }

  console.log(
    `Flagged ${targets.length} record(s) for review (${universities.length} universities, ${programs.length} programs, ${scholarships.length} scholarships).`,
  );
}

main()
  .catch((error) => {
    console.error("[expiry] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
