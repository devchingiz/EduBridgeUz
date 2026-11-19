import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  deleteApplicationAction,
  linkDocumentAction,
  updateApplicationAction,
} from "@/app/dashboard/workspace-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { requireWorkspace } from "@/lib/auth/dal";
import {
  DOCUMENT_CATEGORY_LABELS,
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
} from "@/lib/workspace/constants";
import {
  URGENCY_LABELS,
  deadlineDistanceLabel,
  getDeadlineUrgency,
  getDocumentReadiness,
} from "@/lib/workspace/application-board";
import { getApplication, listDocuments } from "@/lib/workspace/service";

export const metadata: Metadata = {
  title: "Application details",
  robots: { index: false, follow: false },
};

function dateInput(date: Date | null): string {
  return date?.toISOString().slice(0, 10) ?? "";
}

function dateLabel(date: Date | null): string {
  return date
    ? new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(date)
    : "No deadline";
}

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const session = await requireWorkspace();
  const { applicationId } = await params;
  const [application, documents] = await Promise.all([
    getApplication(session.user.id, applicationId),
    listDocuments(session.user.id),
  ]);
  if (!application) notFound();

  const linkedIds = new Set(
    application.documents.map(({ document }) => document.id),
  );
  const now = new Date();
  const urgency = getDeadlineUrgency(
    application.deadline,
    application.status,
    now,
  );
  const readiness = getDocumentReadiness(application);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-muted-foreground text-[12px] font-medium tracking-wide uppercase">
            Application tracker
          </p>
          <h1 className="mt-1 text-2xl font-semibold">
            {application.university.name}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {application.university.city}, {application.university.countryCode}{" "}
            · Deadline you saved: {dateLabel(application.deadline)} (
            {deadlineDistanceLabel(application.deadline, now)})
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">
            {APPLICATION_STATUS_LABELS[application.status]}
          </Badge>
          <Badge
            variant={
              urgency === "overdue" || urgency === "due-soon"
                ? "warning"
                : urgency === "upcoming"
                  ? "brand"
                  : "muted"
            }
          >
            {URGENCY_LABELS[urgency]}
          </Badge>
        </div>
      </header>

      <form
        action={updateApplicationAction}
        className="surface-card space-y-5 p-5 sm:p-6"
      >
        <input type="hidden" name="applicationId" value={application.id} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5 text-sm font-medium">
            Status
            <Select name="status" defaultValue={application.status}>
              {APPLICATION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {APPLICATION_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </label>
          <label className="block space-y-1.5 text-sm font-medium">
            Deadline
            <Input
              type="date"
              name="deadline"
              defaultValue={dateInput(application.deadline)}
            />
          </label>
        </div>
        <label className="block space-y-1.5 text-sm font-medium">
          Progress ({application.progress}%)
          <Input
            type="range"
            min="0"
            max="100"
            step="5"
            name="progress"
            defaultValue={application.progress}
          />
        </label>
        <label className="block space-y-1.5 text-sm font-medium">
          Notes
          <Textarea
            name="notes"
            maxLength={5000}
            defaultValue={application.notes}
            placeholder="Keep next steps and reminders in your own words."
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="submit">Save changes</Button>
          <Button asChild type="button" variant="outline">
            <Link href="/dashboard/applications">Back to board</Link>
          </Button>
        </div>
      </form>

      <section className="surface-card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Application documents</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Only documents in your private library can be linked.{" "}
              {readiness.linked
                ? `${readiness.complete} of ${readiness.linked} linked documents complete.`
                : "No documents linked yet."}
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/documents">Manage documents</Link>
          </Button>
        </div>
        <div className="divide-border mt-4 divide-y">
          {documents.length ? (
            documents.map((document) => {
              const linked = linkedIds.has(document.id);
              return (
                <div
                  key={document.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {document.name}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {DOCUMENT_CATEGORY_LABELS[document.category]} ·{" "}
                      {document.isComplete ? "Complete" : "In progress"}
                    </p>
                  </div>
                  <form action={linkDocumentAction}>
                    <input
                      type="hidden"
                      name="applicationId"
                      value={application.id}
                    />
                    <input
                      type="hidden"
                      name="documentId"
                      value={document.id}
                    />
                    <input
                      type="hidden"
                      name="linked"
                      value={linked ? "false" : "true"}
                    />
                    <Button
                      size="sm"
                      variant={linked ? "outline" : "secondary"}
                    >
                      {linked ? "Unlink" : "Link"}
                    </Button>
                  </form>
                </div>
              );
            })
          ) : (
            <p className="text-muted-foreground py-5 text-sm">
              Upload documents in your library to attach them to this
              application.
            </p>
          )}
        </div>
      </section>

      <section className="surface-card p-5 sm:p-6">
        <h2 className="text-base font-semibold">Status history</h2>
        <ol className="mt-3 space-y-3">
          {application.statusEvents.map((event) => (
            <li key={event.id} className="flex items-start gap-3 text-sm">
              <span className="bg-primary mt-1.5 size-2 shrink-0 rounded-full" />
              <div>
                <p>
                  {event.fromStatus
                    ? `${APPLICATION_STATUS_LABELS[event.fromStatus]} → `
                    : ""}
                  {APPLICATION_STATUS_LABELS[event.toStatus]}
                </p>
                <time
                  className="text-muted-foreground text-xs"
                  dateTime={event.createdAt.toISOString()}
                >
                  {event.createdAt.toLocaleDateString()}
                </time>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <form
        action={deleteApplicationAction}
        className="border-destructive/30 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
      >
        <p className="text-muted-foreground text-sm">
          Remove this application and its status history. Linked documents
          remain in your library.
        </p>
        <input type="hidden" name="applicationId" value={application.id} />
        <Button type="submit" variant="destructive" size="sm">
          Remove application
        </Button>
      </form>
    </div>
  );
}
