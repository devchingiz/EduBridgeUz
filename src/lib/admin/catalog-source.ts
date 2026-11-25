import "server-only";

import type { AdminSourceInput } from "@/lib/admin/catalog-validation";
import { db } from "@/lib/db";

/** Convert a validated ISO day into the UTC midnight Prisma stores for @db.Date. */
export function adminIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/**
 * Source citations are keyed by URL so repeated edits update one citation
 * instead of creating a second, conflicting provenance record.
 */
export async function upsertAdminCitation(
  source: AdminSourceInput,
  actorId: string,
): Promise<string> {
  const citation = await db.sourceCitation.upsert({
    where: { url: source.url },
    create: {
      url: source.url,
      publisher: source.publisher,
      title: source.title,
      accessedAt: adminIsoDate(source.accessedAt),
      verifiedAt: source.verifiedAt ? adminIsoDate(source.verifiedAt) : null,
      notes: source.notes,
      createdById: actorId,
    },
    update: {
      publisher: source.publisher,
      title: source.title,
      accessedAt: adminIsoDate(source.accessedAt),
      verifiedAt: source.verifiedAt ? adminIsoDate(source.verifiedAt) : null,
      notes: source.notes,
    },
    select: { id: true },
  });
  return citation.id;
}

export async function verifyAdminCitation(input: {
  citationId: string;
  verifiedAt: string;
  accessedAt?: string | null;
}): Promise<
  { ok: true; verifiedAt: Date } | { ok: false; reason: "not_found" }
> {
  const existing = await db.sourceCitation.findUnique({
    where: { id: input.citationId },
    select: { id: true },
  });
  if (!existing) return { ok: false, reason: "not_found" };

  const verifiedAt = adminIsoDate(input.verifiedAt);
  await db.sourceCitation.update({
    where: { id: input.citationId },
    data: {
      verifiedAt,
      ...(input.accessedAt
        ? { accessedAt: adminIsoDate(input.accessedAt) }
        : {}),
    },
  });
  return { ok: true, verifiedAt };
}
