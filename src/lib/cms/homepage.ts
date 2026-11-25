import "server-only";

import { unstable_cache } from "next/cache";
import type { Prisma } from "@prisma/client";

import { recordAuditEvent } from "@/lib/auth/audit";
import { db } from "@/lib/db";
import { logError } from "@/lib/observability/logger";
import {
  defaultHomepageContent,
  HOMEPAGE_CACHE_TAG,
  HOMEPAGE_ID,
  homepageContentSchema,
  type HomepageContent,
} from "@/lib/cms/homepage-content";

export type AdminHomepage = {
  content: HomepageContent;
  revision: number;
  updatedAt: string | null;
  updatedByName: string | null;
  usingDefaults: boolean;
};

export type HomepageSaveInput = {
  content: unknown;
  actorId: string;
  ip?: string;
};

export type HomepageSaveResult =
  | { ok: true; revision: number }
  | {
      ok: false;
      message: string;
      fieldErrors?: Record<string, string>;
    };

function parseContent(value: unknown): HomepageContent | null {
  const parsed = homepageContentSchema.safeParse(value);
  if (parsed.success) return parsed.data;

  logError("cms.homepage_invalid_stored_content", null, {
    issueCount: parsed.error.issues.length,
  });
  return null;
}

/** Uncached read for the admin editor and tests. */
export async function getHomepageContent(): Promise<HomepageContent> {
  const row = await db.homepageContent.findUnique({
    where: { id: HOMEPAGE_ID },
    select: { content: true },
  });
  return (row && parseContent(row.content)) || defaultHomepageContent;
}

/**
 * Public read. The cache is invalidated by the save action, so editors never
 * need to wait for a time-based expiry before seeing their change on `/`.
 */
export const getPublishedHomepageContent = unstable_cache(
  async (): Promise<HomepageContent> => getHomepageContent(),
  ["cms-homepage-content-v1"],
  { tags: [HOMEPAGE_CACHE_TAG] },
);

export async function getAdminHomepage(): Promise<AdminHomepage> {
  const row = await db.homepageContent.findUnique({
    where: { id: HOMEPAGE_ID },
    select: {
      content: true,
      revision: true,
      updatedAt: true,
      updatedBy: { select: { name: true } },
    },
  });

  const content = row ? parseContent(row.content) : null;
  return {
    content: content ?? defaultHomepageContent,
    revision: row?.revision ?? 0,
    updatedAt: row ? row.updatedAt.toISOString() : null,
    updatedByName: row?.updatedBy?.name ?? null,
    usingDefaults: !content,
  };
}

export async function saveHomepageContent({
  content,
  actorId,
  ip,
}: HomepageSaveInput): Promise<HomepageSaveResult> {
  const parsed = homepageContentSchema.safeParse(content);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.map(String).join(".") || "form";
      fieldErrors[key] ??= issue.message;
    }
    return {
      ok: false,
      message: "Fix the highlighted fields before saving.",
      fieldErrors,
    };
  }

  const data = parsed.data as unknown as Prisma.InputJsonValue;

  const revision = await db.$transaction(async (tx) => {
    const existing = await tx.homepageContent.findUnique({
      where: { id: HOMEPAGE_ID },
      select: { revision: true },
    });
    const nextRevision = (existing?.revision ?? 0) + 1;

    await tx.homepageContent.upsert({
      where: { id: HOMEPAGE_ID },
      create: {
        id: HOMEPAGE_ID,
        content: data,
        revision: nextRevision,
        updatedById: actorId,
      },
      update: {
        content: data,
        revision: nextRevision,
        updatedById: actorId,
      },
    });
    return nextRevision;
  });

  await recordAuditEvent({
    actorId,
    action: "admin.homepage_updated",
    entityType: "HOMEPAGE",
    entityId: HOMEPAGE_ID,
    metadata: {
      revision,
      sections: Object.keys(parsed.data),
    },
    ip,
  });

  return { ok: true, revision };
}
