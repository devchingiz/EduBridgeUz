import "server-only";

import { PUBLIC_VISIBLE_STATUSES } from "@/lib/catalog/constants";
import { db } from "@/lib/db";

export const NOTE_TITLE_MAX = 200;
export const NOTE_BODY_MAX = 20_000;

export type StudyNoteInput = {
  title: string;
  body: string;
  universityId: string | null;
  programId: string | null;
  scholarshipId: string | null;
};

export type StudyNoteItem = StudyNoteInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
  universityName: string | null;
  programName: string | null;
  scholarshipName: string | null;
};

export type NoteResult =
  { ok: true; noteId?: string } | { ok: false; message: string };

const visibleStatuses = [...PUBLIC_VISIBLE_STATUSES];

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function parseNoteInput(formData: FormData): StudyNoteInput | null {
  const title = cleanText(formData.get("title"), NOTE_TITLE_MAX);
  const body = cleanText(formData.get("body"), NOTE_BODY_MAX);
  if (!title || !body) return null;

  const optionalId = (key: string): string | null => {
    const value = cleanText(formData.get(key), 100);
    return value || null;
  };

  return {
    title,
    body,
    universityId: optionalId("universityId"),
    programId: optionalId("programId"),
    scholarshipId: optionalId("scholarshipId"),
  };
}

/** Ensures optional links point at visible catalog records, not arbitrary ids. */
async function validAssociations(input: StudyNoteInput): Promise<boolean> {
  const checks: Array<Promise<boolean>> = [];
  if (input.universityId) {
    checks.push(
      db.university
        .count({
          where: {
            id: input.universityId,
            verificationStatus: { in: visibleStatuses },
          },
        })
        .then((count) => count === 1),
    );
  }
  if (input.programId) {
    checks.push(
      db.program
        .count({
          where: {
            id: input.programId,
            verificationStatus: { in: visibleStatuses },
          },
        })
        .then((count) => count === 1),
    );
  }
  if (input.scholarshipId) {
    checks.push(
      db.scholarship
        .count({
          where: {
            id: input.scholarshipId,
            verificationStatus: { in: visibleStatuses },
          },
        })
        .then((count) => count === 1),
    );
  }
  return (await Promise.all(checks)).every(Boolean);
}

const noteInclude = {
  university: { select: { name: true } },
  program: { select: { name: true } },
  scholarship: { select: { name: true } },
} as const;

function toItem(row: {
  id: string;
  title: string;
  body: string;
  universityId: string | null;
  programId: string | null;
  scholarshipId: string | null;
  createdAt: Date;
  updatedAt: Date;
  university: { name: string } | null;
  program: { name: string } | null;
  scholarship: { name: string } | null;
}): StudyNoteItem {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    universityId: row.universityId,
    programId: row.programId,
    scholarshipId: row.scholarshipId,
    createdAt: row.createdAt.toISOString().slice(0, 10),
    updatedAt: row.updatedAt.toISOString().slice(0, 10),
    universityName: row.university?.name ?? null,
    programName: row.program?.name ?? null,
    scholarshipName: row.scholarship?.name ?? null,
  };
}

export async function listStudyNotes(userId: string): Promise<StudyNoteItem[]> {
  const rows = await db.studyNote.findMany({
    where: { userId },
    include: noteInclude,
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(toItem);
}

export async function getStudyNote(
  userId: string,
  id: string,
): Promise<StudyNoteItem | null> {
  const row = await db.studyNote.findFirst({
    where: { id, userId },
    include: noteInclude,
  });
  return row ? toItem(row) : null;
}

export async function createStudyNote(
  userId: string,
  input: StudyNoteInput,
): Promise<NoteResult> {
  if (!(await validAssociations(input))) {
    return { ok: false, message: "A linked catalog record is unavailable." };
  }
  const note = await db.studyNote.create({
    data: { ...input, userId },
    select: { id: true },
  });
  return { ok: true, noteId: note.id };
}

export async function updateStudyNote(
  userId: string,
  id: string,
  input: StudyNoteInput,
): Promise<NoteResult> {
  if (!(await validAssociations(input))) {
    return { ok: false, message: "A linked catalog record is unavailable." };
  }
  // The owner condition is part of the update filter, so a forged id cannot
  // touch another user's note.
  const result = await db.studyNote.updateMany({
    where: { id, userId },
    data: input,
  });
  return result.count === 1
    ? { ok: true }
    : { ok: false, message: "That note is no longer available." };
}

export async function deleteStudyNote(
  userId: string,
  id: string,
): Promise<NoteResult> {
  const result = await db.studyNote.deleteMany({ where: { id, userId } });
  return result.count === 1
    ? { ok: true }
    : { ok: false, message: "That note is no longer available." };
}
