import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  deleteStudyNoteAction,
  updateStudyNoteAction,
} from "@/app/dashboard/notes/actions";
import { SubmitButton } from "@/components/auth/submit-button";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { requireWorkspace } from "@/lib/auth/dal";
import { listCatalogFavorites } from "@/lib/catalog/favorites";
import { getStudyNote } from "@/lib/catalog/notes";

export const metadata: Metadata = {
  title: "Edit Study Note",
  robots: { index: false, follow: false },
};

export default async function StudyNotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const session = await requireWorkspace();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [note, favorites] = await Promise.all([
    getStudyNote(session.user.id, id),
    listCatalogFavorites(session.user.id),
  ]);
  if (!note) notFound();

  const universityOptions = favorites.filter(
    (favorite) => favorite.entityType === "UNIVERSITY",
  );
  const linkedId = note.universityId ?? "";
  const hasExternalLink =
    linkedId && !universityOptions.some((favorite) => favorite.id === linkedId);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <nav aria-label="Breadcrumb">
        <Link
          href="/dashboard/notes"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← All notes
        </Link>
      </nav>

      {query.saved === "1" ? (
        <Alert variant="success">Note updated.</Alert>
      ) : null}

      <section className="surface-card p-5 sm:p-6">
        <h1 className="text-xl font-semibold">Edit note</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Updated {note.updatedAt}. Only you can read this note.
        </p>
        <form action={updateStudyNoteAction} className="mt-5 space-y-4">
          <input type="hidden" name="id" value={note.id} />
          <div className="space-y-1.5">
            <Label htmlFor="edit-note-title">Title</Label>
            <Input
              id="edit-note-title"
              name="title"
              required
              maxLength={200}
              defaultValue={note.title}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-note-body">Note</Label>
            <Textarea
              id="edit-note-body"
              name="body"
              required
              rows={10}
              maxLength={20000}
              defaultValue={note.body}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-note-university">Linked university</Label>
            <Select
              id="edit-note-university"
              name="universityId"
              defaultValue={linkedId}
            >
              <option value="">No linked university</option>
              {hasExternalLink ? (
                <option value={linkedId}>
                  {note.universityName ?? "Selected university"}
                </option>
              ) : null}
              {universityOptions.map((favorite) => (
                <option key={favorite.id} value={favorite.id}>
                  {favorite.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
            <Button asChild variant="outline">
              <Link href="/dashboard/notes">Cancel</Link>
            </Button>
          </div>
        </form>
      </section>

      <section className="surface-card p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-red-700 dark:text-red-400">
          Delete note
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          This permanently removes the note. It cannot be undone.
        </p>
        <form action={deleteStudyNoteAction} className="mt-3">
          <input type="hidden" name="id" value={note.id} />
          <SubmitButton variant="destructive" pendingLabel="Deleting…">
            Delete note
          </SubmitButton>
        </form>
      </section>
    </div>
  );
}
