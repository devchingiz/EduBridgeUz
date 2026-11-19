"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireWorkspace } from "@/lib/auth/dal";
import {
  createStudyNote,
  deleteStudyNote,
  parseNoteInput,
  updateStudyNote,
} from "@/lib/catalog/notes";
import { assertSameOrigin } from "@/lib/http/request";

function value(formData: FormData, key: string): string {
  const field = formData.get(key);
  return typeof field === "string" ? field.trim() : "";
}

function revalidateNotes(): void {
  revalidatePath("/dashboard/notes");
  revalidatePath("/dashboard");
}

export async function createStudyNoteAction(formData: FormData) {
  await assertSameOrigin();
  const session = await requireWorkspace();
  const input = parseNoteInput(formData);
  if (!input) throw new Error("A title and note body are required.");

  const result = await createStudyNote(session.user.id, input);
  if (!result.ok) throw new Error(result.message);
  if (!result.noteId) throw new Error("The note could not be saved.");

  revalidateNotes();
  redirect(`/dashboard/notes/${result.noteId}`);
}

export async function updateStudyNoteAction(formData: FormData) {
  await assertSameOrigin();
  const session = await requireWorkspace();
  const id = value(formData, "id");
  const input = parseNoteInput(formData);
  if (!id || !input) throw new Error("A title and note body are required.");

  const result = await updateStudyNote(session.user.id, id, input);
  if (!result.ok) throw new Error(result.message);

  revalidateNotes();
  redirect(`/dashboard/notes/${id}?saved=1`);
}

export async function deleteStudyNoteAction(formData: FormData) {
  await assertSameOrigin();
  const session = await requireWorkspace();
  const id = value(formData, "id");
  if (!id) return;

  const result = await deleteStudyNote(session.user.id, id);
  if (!result.ok) throw new Error(result.message);

  revalidateNotes();
  redirect("/dashboard/notes?deleted=1");
}
