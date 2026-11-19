import type { Metadata } from "next";
import Link from "next/link";

import { createStudyNoteAction } from "@/app/dashboard/notes/actions";
import { SubmitButton } from "@/components/auth/submit-button";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { requireWorkspace } from "@/lib/auth/dal";
import { listCatalogFavorites } from "@/lib/catalog/favorites";
import { listStudyNotes } from "@/lib/catalog/notes";

export const metadata: Metadata = {
  title: "Study Notes",
  robots: { index: false, follow: false },
};

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{
    university?: string;
    created?: string;
    deleted?: string;
  }>;
}) {
  const session = await requireWorkspace();
  const [query, notes, favorites] = await Promise.all([
    searchParams,
    listStudyNotes(session.user.id),
    listCatalogFavorites(session.user.id),
  ]);
  const universityOptions = favorites.filter(
    (favorite) => favorite.entityType === "UNIVERSITY",
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Study notes</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Private research notes, visible only to you. Link a note to a saved
          university to keep your thinking alongside the catalog facts.
        </p>
      </header>

      {query.created === "1" ? (
        <Alert variant="success">Note saved.</Alert>
      ) : null}
      {query.deleted === "1" ? (
        <Alert variant="success">Note deleted.</Alert>
      ) : null}

      <section className="surface-card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">New note</h2>
        <form action={createStudyNoteAction} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="note-title">Title</Label>
            <Input
              id="note-title"
              name="title"
              required
              maxLength={200}
              placeholder="Why this university interests me"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note-body">Note</Label>
            <Textarea
              id="note-body"
              name="body"
              required
              rows={5}
              maxLength={20000}
              placeholder="Record questions, deadlines to confirm, or programme comparisons."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note-university">
              Linked university (optional)
            </Label>
            <Select
              id="note-university"
              name="universityId"
              defaultValue={query.university ?? ""}
            >
              <option value="">No linked university</option>
              {universityOptions.map((favorite) => (
                <option key={favorite.id} value={favorite.id}>
                  {favorite.name}
                </option>
              ))}
              {query.university &&
              !universityOptions.some(
                (favorite) => favorite.id === query.university,
              ) ? (
                <option value={query.university}>Selected university</option>
              ) : null}
            </Select>
          </div>
          <SubmitButton pendingLabel="Saving…">Save note</SubmitButton>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Your notes</h2>
        {notes.length === 0 ? (
          <div className="surface-card px-6 py-10 text-center">
            <p className="text-muted-foreground text-sm">
              You have not written any notes yet.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {notes.map((note) => (
              <article key={note.id} className="surface-card p-5">
                <h3 className="font-semibold">
                  <Link
                    href={`/dashboard/notes/${note.id}`}
                    className="hover:text-primary hover:underline"
                  >
                    {note.title}
                  </Link>
                </h3>
                <p className="text-muted-foreground mt-1 line-clamp-3 text-sm">
                  {note.body}
                </p>
                <p className="text-muted-foreground mt-3 text-xs">
                  {note.universityName ? `${note.universityName} · ` : ""}
                  Updated {note.updatedAt}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
