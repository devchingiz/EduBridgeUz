import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Upload } from "lucide-react";

import {
  deleteDocumentAction,
  updateDocumentAction,
} from "@/app/dashboard/workspace-actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { requireWorkspace } from "@/lib/auth/dal";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABELS,
  PRIVATE_DOCUMENT_MAX_BYTES,
} from "@/lib/workspace/constants";
import { listDocuments } from "@/lib/workspace/service";

export const metadata: Metadata = {
  title: "Documents",
  robots: { index: false, follow: false },
};

function sizeLabel(size: number): string {
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; uploaded?: string; saved?: string }>;
}) {
  const session = await requireWorkspace();
  const [documents, query] = await Promise.all([
    listDocuments(session.user.id),
    searchParams,
  ]);
  const errorMessage =
    query.error === "too-large"
      ? "The upload is too large. Maximum file size is 5 MB."
      : query.error === "rate-limited"
        ? "You have uploaded several files recently. Try again later."
        : query.error === "quarantined"
          ? "The security scanner flagged this file. It was quarantined and was not added to your library."
          : query.error === "scanner-unavailable"
            ? "The security scan could not be completed. The file was not added; please try again later."
            : query.error === "upload-failed"
              ? "The file could not be securely stored. It was not added; please try again later."
              : query.error === "invalid-upload"
                ? "Choose a PDF, JPEG, PNG, or WebP file under 5 MB."
                : null;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-muted-foreground text-[12px] font-medium tracking-wide uppercase">
          Student workspace
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.025em]">
          Document manager
        </h1>
        <p className="text-muted-foreground mt-1 text-sm leading-6">
          Private to your account. Upload PDF or image files up to 5 MB; only
          supported formats can be previewed.
        </p>
      </header>

      <section className="surface-card p-5 sm:p-6">
        <h2 className="text-base font-semibold">Upload a document</h2>
        {errorMessage ? (
          <p role="alert" className="text-destructive mt-3 text-sm">
            {errorMessage}
          </p>
        ) : null}
        {query.uploaded ? (
          <p
            role="status"
            className="mt-3 text-sm text-emerald-700 dark:text-emerald-400"
          >
            Document uploaded to your private library.
          </p>
        ) : null}
        {query.saved ? (
          <p
            role="status"
            className="mt-3 text-sm text-emerald-700 dark:text-emerald-400"
          >
            Document details saved.
          </p>
        ) : null}
        <form
          action="/dashboard/documents/upload"
          method="post"
          encType="multipart/form-data"
          className="mt-4 grid gap-3 sm:grid-cols-2"
        >
          <label className="space-y-1.5 text-sm font-medium">
            Document name
            <Input
              name="name"
              maxLength={120}
              placeholder="Optional; defaults to file name"
            />
          </label>
          <label className="space-y-1.5 text-sm font-medium">
            Category
            <Select name="category" required defaultValue="OTHER">
              {DOCUMENT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {DOCUMENT_CATEGORY_LABELS[category]}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-1.5 text-sm font-medium sm:col-span-2">
            File{" "}
            <span className="text-muted-foreground font-normal">
              · PDF, JPEG, PNG, WebP · max{" "}
              {PRIVATE_DOCUMENT_MAX_BYTES / 1024 / 1024} MB
            </span>
            <Input
              name="file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
              required
            />
          </label>
          <div className="sm:col-span-2">
            <Button type="submit">
              <Upload /> Upload securely
            </Button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Your library</h2>
            <p className="text-muted-foreground text-sm">
              {documents.filter((document) => document.isComplete).length} of{" "}
              {documents.length} documents marked complete
            </p>
          </div>
        </div>
        {documents.length ? (
          documents.map((document) => (
            <article key={document.id} className="surface-card p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <FileText
                    aria-hidden="true"
                    className="text-muted-foreground mt-1 size-4 shrink-0"
                  />
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">
                      {document.name}
                    </h3>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {DOCUMENT_CATEGORY_LABELS[document.category]} ·{" "}
                      {sizeLabel(document.sizeBytes)} ·{" "}
                      {document.isComplete ? "Complete" : "In progress"}
                    </p>
                    {document.applications.length ? (
                      <p className="text-muted-foreground mt-1 text-xs">
                        Linked to:{" "}
                        {document.applications
                          .map(({ application }) => application.university.name)
                          .join(", ")}
                      </p>
                    ) : null}
                    <Link
                      href={`/dashboard/documents/${document.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary mt-2 inline-block text-xs font-medium underline underline-offset-2"
                    >
                      Preview
                    </Link>
                  </div>
                </div>
                <form action={deleteDocumentAction}>
                  <input type="hidden" name="documentId" value={document.id} />
                  <Button type="submit" size="sm" variant="outline">
                    Delete
                  </Button>
                </form>
              </div>
              <form
                action={updateDocumentAction}
                className="border-border mt-4 grid gap-3 border-t pt-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end"
              >
                <input type="hidden" name="documentId" value={document.id} />
                <label className="space-y-1 text-xs font-medium">
                  Rename
                  <Input
                    name="name"
                    maxLength={120}
                    defaultValue={document.name}
                    required
                  />
                </label>
                <label className="space-y-1 text-xs font-medium">
                  Category
                  <Select name="category" defaultValue={document.category}>
                    {DOCUMENT_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {DOCUMENT_CATEGORY_LABELS[category]}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="flex items-center gap-2 pb-2 text-xs font-medium">
                  <Checkbox
                    name="isComplete"
                    defaultChecked={document.isComplete}
                  />
                  Complete
                </label>
                <Button type="submit" size="sm" variant="secondary">
                  Save
                </Button>
              </form>
            </article>
          ))
        ) : (
          <div className="surface-card px-6 py-10 text-center">
            <p className="text-muted-foreground text-sm">
              Your private library is empty. Add a document when you are ready.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
