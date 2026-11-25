import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Next's incremental cache is supplied by the request runtime, not a bare
// Vitest worker. Keep the cached reader under test while treating the cache as
// a transparent pass-through in this database integration suite.
vi.mock("next/cache", () => ({
  unstable_cache: (callback: unknown) => callback,
  revalidateTag: () => undefined,
  revalidatePath: () => undefined,
}));

import {
  defaultHomepageContent,
  HOMEPAGE_ID,
  type HomepageContent,
} from "@/lib/cms/homepage-content";
import {
  getAdminHomepage,
  getHomepageContent,
  getPublishedHomepageContent,
  saveHomepageContent,
} from "@/lib/cms/homepage";
import { db } from "@/lib/db";

const actor = { id: "" };

function editedContent(title: string): HomepageContent {
  const content = JSON.parse(
    JSON.stringify(defaultHomepageContent),
  ) as HomepageContent;
  content.hero.titleLead = title;
  return content;
}

beforeEach(async () => {
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE "HomepageContent", "AuditEvent", "User" RESTART IDENTITY CASCADE',
  );
  const user = await db.user.create({
    data: {
      email: "cms-editor@example.com",
      name: "CMS Editor",
      dateOfBirth: new Date("1995-06-15"),
      emailVerifiedAt: new Date(),
      role: "CONTENT_MANAGER",
    },
  });
  actor.id = user.id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("homepage CMS persistence", () => {
  it("falls back to shipped copy when no document exists", async () => {
    expect(await getHomepageContent()).toEqual(defaultHomepageContent);

    const admin = await getAdminHomepage();
    expect(admin.content).toEqual(defaultHomepageContent);
    expect(admin.usingDefaults).toBe(true);
    expect(admin.revision).toBe(0);
    expect(admin.updatedAt).toBeNull();
  });

  it("persists validated content, increments revisions, and audits saves", async () => {
    const first = await saveHomepageContent({
      content: editedContent("First saved headline."),
      actorId: actor.id,
      ip: "203.0.113.10",
    });
    expect(first).toEqual({ ok: true, revision: 1 });

    const second = await saveHomepageContent({
      content: editedContent("Second saved headline."),
      actorId: actor.id,
    });
    expect(second).toEqual({ ok: true, revision: 2 });

    const row = await db.homepageContent.findUniqueOrThrow({
      where: { id: HOMEPAGE_ID },
    });
    expect(row.revision).toBe(2);
    expect(row.updatedById).toBe(actor.id);
    expect(
      (row.content as { hero: { titleLead: string } }).hero.titleLead,
    ).toBe("Second saved headline.");

    const admin = await getAdminHomepage();
    expect(admin.usingDefaults).toBe(false);
    expect(admin.revision).toBe(2);
    expect(admin.updatedByName).toBe("CMS Editor");
    expect(admin.content.hero.titleLead).toBe("Second saved headline.");

    const events = await db.auditEvent.findMany({
      where: { action: "admin.homepage_updated" },
      orderBy: { createdAt: "asc" },
    });
    expect(events).toHaveLength(2);
    expect(events.map((event) => event.entityType)).toEqual([
      "HOMEPAGE",
      "HOMEPAGE",
    ]);
    expect(events.map((event) => event.entityId)).toEqual([
      HOMEPAGE_ID,
      HOMEPAGE_ID,
    ]);
    expect(events[0].ipHash).toBeTruthy();
    expect(events[1].ipHash).toBeNull();
    expect(events[1].metadata).toMatchObject({ revision: 2 });
  });

  it("rejects unsafe or malformed writes without touching storage", async () => {
    const markup = editedContent("<script>alert(1)</script>");
    const external = editedContent("External headline.");
    external.hero.primaryCta.href = "https://attacker.example" as never;

    const markupResult = await saveHomepageContent({
      content: markup,
      actorId: actor.id,
    });
    const externalResult = await saveHomepageContent({
      content: external,
      actorId: actor.id,
    });

    expect(markupResult.ok).toBe(false);
    expect(externalResult.ok).toBe(false);
    if (!markupResult.ok) {
      expect(
        Object.keys(markupResult.fieldErrors ?? {}).length,
      ).toBeGreaterThan(0);
    }
    expect(await db.homepageContent.count()).toBe(0);
    expect(await db.auditEvent.count()).toBe(0);
  });

  it("publishes saved copy through the cached public reader", async () => {
    const saved = await saveHomepageContent({
      content: editedContent("Public headline from the CMS."),
      actorId: actor.id,
    });
    expect(saved).toEqual({ ok: true, revision: 1 });

    const publicContent = await getPublishedHomepageContent();
    expect(publicContent.hero.titleLead).toBe("Public headline from the CMS.");
    expect(publicContent.faq.items).toHaveLength(
      defaultHomepageContent.faq.items.length,
    );
  });
});
