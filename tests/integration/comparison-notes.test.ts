import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import {
  addToComparison,
  getComparison,
  getComparisonIds,
  removeFromComparison,
  setComparison,
} from "@/lib/catalog/comparison";
import {
  createStudyNote,
  deleteStudyNote,
  getStudyNote,
  listStudyNotes,
  updateStudyNote,
} from "@/lib/catalog/notes";

let ownerId = "";
let otherId = "";
let universityIds: string[] = [];
let hiddenUniversityId = "";
let programId = "";

const noteInput = (
  overrides: Partial<Parameters<typeof createStudyNote>[1]> = {},
) => ({
  title: "Research note",
  body: "Compare tuition and intake dates.",
  universityId: null,
  programId: null,
  scholarshipId: null,
  ...overrides,
});

beforeEach(async () => {
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE "StudyNote", "UniversityComparison", "StudentNotification", "NotificationPreference", "ApplicationDocument", "StudentDocument", "ApplicationStatusEvent", "Application", "UniversityFavorite", "ScholarshipFavorite", "ProgramScholarship", "ProgramIntake", "ProgramCost", "CatalogReview", "Requirement", "TuitionFact", "DeadlineFact", "Program", "Scholarship", "University", "SourceCitation", "AuditEvent", "RateLimitCounter", "ConsentRecord", "AuthToken", "Session", "StudentProfile", "User" RESTART IDENTITY CASCADE',
  );

  const [owner, other] = await Promise.all([
    db.user.create({
      data: { email: "compare-owner@example.test", name: "Comparison Owner" },
      select: { id: true },
    }),
    db.user.create({
      data: { email: "compare-other@example.test", name: "Other Owner" },
      select: { id: true },
    }),
  ]);
  ownerId = owner.id;
  otherId = other.id;

  const source = await db.sourceCitation.create({
    data: {
      url: "https://example.edu/about",
      publisher: "Example University",
      title: "University profile",
      accessedAt: new Date("2026-11-17T00:00:00.000Z"),
      verifiedAt: new Date("2026-11-17T00:00:00.000Z"),
    },
    select: { id: true },
  });

  universityIds = [];
  for (let index = 1; index <= 5; index += 1) {
    const university = await db.university.create({
      data: {
        slug: `comparison-university-${index}`,
        name: `Comparison University ${index}`,
        city: "Berlin",
        countryCode: "DE",
        websiteUrl: `https://example${index}.edu/`,
        rankingDisplay: `${index}`,
        continent: "Europe",
        institutionType: "Public",
        verificationStatus: "VERIFIED",
        lastVerifiedAt: new Date("2026-11-17T00:00:00.000Z"),
        primarySourceId: source.id,
      },
      select: { id: true },
    });
    universityIds.push(university.id);
  }

  const hidden = await db.university.create({
    data: {
      slug: "hidden-university",
      name: "Hidden University",
      city: "Berlin",
      countryCode: "DE",
      verificationStatus: "UNVERIFIED",
      primarySourceId: source.id,
    },
    select: { id: true },
  });
  hiddenUniversityId = hidden.id;

  const program = await db.program.create({
    data: {
      universityId: universityIds[0],
      slug: "comparison-msc",
      name: "MSc Comparison Studies",
      degreeLevel: "MASTER",
      field: "Computer Science",
      language: "English",
      verificationStatus: "VERIFIED",
      primarySourceId: source.id,
    },
    select: { id: true },
  });
  programId = program.id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("comparison shortlist", () => {
  it("enforces the four-item cap server-side", async () => {
    const result = await setComparison(ownerId, universityIds);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/at most 4/i);
    }
    expect(await getComparisonIds(ownerId)).toEqual([]);
  });

  it("accepts up to four unique, visible universities in saved order", async () => {
    const selected = universityIds.slice(0, 4);
    const result = await setComparison(ownerId, [...selected, selected[0]]);
    expect(result.ok).toBe(true);
    expect(await getComparisonIds(ownerId)).toEqual(selected);

    const items = await getComparison(ownerId);
    expect(items.map((item) => item.id)).toEqual(selected);
    expect(items[0].rankingDisplay).toBe("1");
    expect(items[0].programCount).toBe(1);
    expect(items[0].languages).toEqual(["English"]);
  });

  it("rejects ids that are not publicly visible", async () => {
    const result = await setComparison(ownerId, [
      universityIds[0],
      hiddenUniversityId,
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/no longer available/i);
    }
  });

  it("adds and removes a single university without exceeding the cap", async () => {
    expect((await addToComparison(ownerId, universityIds[0])).ok).toBe(true);
    expect((await addToComparison(ownerId, universityIds[0])).ok).toBe(true);
    expect(await getComparisonIds(ownerId)).toEqual([universityIds[0]]);

    for (const id of universityIds.slice(1, 4)) {
      expect((await addToComparison(ownerId, id)).ok).toBe(true);
    }
    const overCap = await addToComparison(ownerId, universityIds[4]);
    expect(overCap.ok).toBe(false);

    const removed = await removeFromComparison(ownerId, universityIds[1]);
    expect(removed.ok).toBe(true);
    expect(await getComparisonIds(ownerId)).toEqual([
      universityIds[0],
      universityIds[2],
      universityIds[3],
    ]);
  });

  it("keeps shortlists isolated between users", async () => {
    await setComparison(ownerId, universityIds.slice(0, 2));
    expect(await getComparisonIds(ownerId)).toHaveLength(2);
    expect(await getComparisonIds(otherId)).toEqual([]);
  });

  it("drops rows that become unavailable after being saved", async () => {
    await setComparison(ownerId, universityIds.slice(0, 2));
    await db.university.update({
      where: { id: universityIds[1] },
      data: { verificationStatus: "UNVERIFIED" },
    });
    const items = await getComparison(ownerId);
    expect(items.map((item) => item.id)).toEqual([universityIds[0]]);
  });
});

describe("private study notes", () => {
  it("creates and lists a note owned by the student", async () => {
    const created = await createStudyNote(
      ownerId,
      noteInput({ universityId: universityIds[0] }),
    );
    expect(created.ok).toBe(true);

    const notes = await listStudyNotes(ownerId);
    expect(notes).toHaveLength(1);
    expect(notes[0].title).toBe("Research note");
    expect(notes[0].universityName).toBe("Comparison University 1");
    expect(await listStudyNotes(otherId)).toEqual([]);
  });

  it("rejects links to hidden or non-existent catalog records", async () => {
    expect(
      (
        await createStudyNote(
          ownerId,
          noteInput({ universityId: hiddenUniversityId }),
        )
      ).ok,
    ).toBe(false);
    expect(
      (
        await createStudyNote(
          ownerId,
          noteInput({ programId: "missing-program" }),
        )
      ).ok,
    ).toBe(false);
    expect(
      (
        await createStudyNote(
          ownerId,
          noteInput({ scholarshipId: "missing-scholarship" }),
        )
      ).ok,
    ).toBe(false);
  });

  it("allows a note linked to a visible program", async () => {
    const created = await createStudyNote(ownerId, noteInput({ programId }));
    expect(created.ok).toBe(true);
    const notes = await listStudyNotes(ownerId);
    expect(notes[0].programName).toBe("MSc Comparison Studies");
  });

  it("does not let another user read, update or delete a note", async () => {
    const created = await createStudyNote(ownerId, noteInput());
    expect(created.ok).toBe(true);
    if (!created.ok || !created.noteId) throw new Error("expected note id");
    const noteId = created.noteId;

    expect(await getStudyNote(otherId, noteId)).toBeNull();
    expect((await updateStudyNote(otherId, noteId, noteInput())).ok).toBe(
      false,
    );
    expect((await deleteStudyNote(otherId, noteId)).ok).toBe(false);
    expect(await getStudyNote(ownerId, noteId)).not.toBeNull();
  });

  it("updates and deletes the owner's note", async () => {
    const created = await createStudyNote(ownerId, noteInput());
    expect(created.ok).toBe(true);
    if (!created.ok || !created.noteId) throw new Error("expected note id");
    const noteId = created.noteId;

    const updated = await updateStudyNote(
      ownerId,
      noteId,
      noteInput({ title: "Updated title" }),
    );
    expect(updated.ok).toBe(true);
    expect((await getStudyNote(ownerId, noteId))?.title).toBe("Updated title");

    expect((await deleteStudyNote(ownerId, noteId)).ok).toBe(true);
    expect(await getStudyNote(ownerId, noteId)).toBeNull();
  });
});
