import "server-only";

import type { CatalogEntityTypeValue } from "@/lib/catalog/constants";
import {
  PUBLIC_VISIBLE_STATUSES,
  type VerificationStatusValue,
} from "@/lib/catalog/constants";
import { countryName } from "@/lib/data/countries";
import { db } from "@/lib/db";

export type CatalogFavoriteItem = {
  id: string;
  entityType: "UNIVERSITY" | "SCHOLARSHIP";
  slug: string;
  name: string;
  context: string;
  status: VerificationStatusValue;
  savedAt: Date;
};

export async function setCatalogFavorite(
  userId: string,
  entityType: CatalogEntityTypeValue,
  entityId: string,
  saved: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (entityType === "UNIVERSITY") {
    const where = { userId_universityId: { userId, universityId: entityId } };
    if (!saved) {
      await db.universityFavorite.deleteMany({
        where: { userId, universityId: entityId },
      });
      return { ok: true };
    }

    const university = await db.university.findFirst({
      where: {
        id: entityId,
        verificationStatus: { in: [...PUBLIC_VISIBLE_STATUSES] },
      },
      select: { id: true },
    });
    if (!university) {
      return { ok: false, message: "That university is no longer available." };
    }

    await db.universityFavorite.upsert({
      where,
      create: { userId, universityId: entityId },
      update: {},
    });
    return { ok: true };
  }

  if (entityType === "SCHOLARSHIP") {
    const where = { userId_scholarshipId: { userId, scholarshipId: entityId } };
    if (!saved) {
      await db.scholarshipFavorite.deleteMany({
        where: { userId, scholarshipId: entityId },
      });
      return { ok: true };
    }

    const scholarship = await db.scholarship.findFirst({
      where: {
        id: entityId,
        verificationStatus: { in: [...PUBLIC_VISIBLE_STATUSES] },
      },
      select: { id: true },
    });
    if (!scholarship) {
      return { ok: false, message: "That scholarship is no longer available." };
    }

    await db.scholarshipFavorite.upsert({
      where,
      create: { userId, scholarshipId: entityId },
      update: {},
    });
    return { ok: true };
  }

  return { ok: false, message: "That catalog record cannot be saved." };
}

export async function listCatalogFavorites(
  userId: string,
): Promise<CatalogFavoriteItem[]> {
  const [universities, scholarships] = await Promise.all([
    db.universityFavorite.findMany({
      where: { userId },
      include: {
        university: {
          select: {
            id: true,
            slug: true,
            name: true,
            city: true,
            countryCode: true,
            verificationStatus: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.scholarshipFavorite.findMany({
      where: { userId },
      include: {
        scholarship: {
          select: {
            id: true,
            slug: true,
            name: true,
            providerName: true,
            hostCountryCode: true,
            verificationStatus: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return [
    ...universities.map(({ university, createdAt }) => ({
      id: university.id,
      entityType: "UNIVERSITY" as const,
      slug: university.slug,
      name: university.name,
      context: `${university.city}, ${countryName(university.countryCode)}`,
      status: university.verificationStatus,
      savedAt: createdAt,
    })),
    ...scholarships.map(({ scholarship, createdAt }) => ({
      id: scholarship.id,
      entityType: "SCHOLARSHIP" as const,
      slug: scholarship.slug,
      name: scholarship.name,
      context: scholarship.hostCountryCode
        ? `${scholarship.providerName}, ${countryName(scholarship.hostCountryCode)}`
        : scholarship.providerName,
      status: scholarship.verificationStatus,
      savedAt: createdAt,
    })),
  ].sort((a, b) => b.savedAt.getTime() - a.savedAt.getTime());
}

export async function isCatalogFavorite(
  userId: string | undefined,
  entityType: "UNIVERSITY" | "SCHOLARSHIP",
  entityId: string,
): Promise<boolean> {
  if (!userId) return false;
  if (entityType === "UNIVERSITY") {
    return Boolean(
      await db.universityFavorite.findUnique({
        where: { userId_universityId: { userId, universityId: entityId } },
        select: { id: true },
      }),
    );
  }
  return Boolean(
    await db.scholarshipFavorite.findUnique({
      where: { userId_scholarshipId: { userId, scholarshipId: entityId } },
      select: { id: true },
    }),
  );
}
