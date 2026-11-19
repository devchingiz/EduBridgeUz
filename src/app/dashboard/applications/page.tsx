import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarDays, Plus } from "lucide-react";

import { setApplicationStatusAction } from "@/app/dashboard/workspace-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { requireWorkspace } from "@/lib/auth/dal";
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
} from "@/lib/workspace/constants";
import {
  APPLICATION_SORT_LABELS,
  DEADLINE_FILTER_LABELS,
  URGENCY_LABELS,
  buildApplicationBoard,
  deadlineDistanceLabel,
  getDeadlineUrgency,
  getDocumentReadiness,
  hasActiveFilters,
  parseApplicationFilters,
  type ApplicationBoardRow,
  type DeadlineUrgency,
} from "@/lib/workspace/application-board";
import { listApplications } from "@/lib/workspace/service";

export const metadata: Metadata = {
  title: "Applications",
  robots: { index: false, follow: false },
};

type ApplicationsQuery = {
  q?: string | string[];
  status?: string | string[];
  urgency?: string | string[];
  sort?: string | string[];
};

const URGENCY_VARIANTS: Record<
  DeadlineUrgency,
  "warning" | "brand" | "secondary" | "muted"
> = {
  overdue: "warning",
  "due-soon": "warning",
  upcoming: "brand",
  later: "secondary",
  "no-deadline": "muted",
  closed: "muted",
};

function dateLabel(date: Date | null): string {
  return date
    ? new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(date)
    : "No deadline";
}

function ApplicationCard({
  application,
  now,
}: {
  application: ApplicationBoardRow;
  now: Date;
}) {
  const urgency = getDeadlineUrgency(
    application.deadline,
    application.status,
    now,
  );
  const readiness = getDocumentReadiness(application);

  return (
    <article className="surface-card hover:border-primary/40 min-w-0 p-3 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/dashboard/applications/${application.id}`}
          className="min-w-0 text-sm font-semibold hover:underline"
        >
          {application.university.name}
        </Link>
        <Badge variant={URGENCY_VARIANTS[urgency]}>
          {URGENCY_LABELS[urgency]}
        </Badge>
      </div>
      <p className="text-muted-foreground mt-0.5 text-xs">
        {application.university.city}, {application.university.countryCode}
      </p>
      {application.notes ? (
        <p className="text-muted-foreground mt-2 truncate text-xs">
          {application.notes}
        </p>
      ) : null}

      <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="size-3" aria-hidden="true" />
          {dateLabel(application.deadline)}
        </span>
        <span aria-hidden="true">·</span>
        <span>{deadlineDistanceLabel(application.deadline, now)}</span>
      </div>

      <div className="mt-2">
        <div className="text-muted-foreground mb-1 flex justify-between text-[11px]">
          <span>Progress</span>
          <span>{application.progress}%</span>
        </div>
        <div className="bg-muted h-1.5 overflow-hidden rounded-full">
          <div
            className="bg-primary h-full rounded-full"
            style={{ width: `${application.progress}%` }}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <Badge
          variant={
            readiness.remaining > 0
              ? "warning"
              : readiness.linked > 0
                ? "success"
                : "muted"
          }
        >
          {readiness.linked > 0
            ? `${readiness.complete}/${readiness.linked} docs ready`
            : "No docs linked"}
        </Badge>
        <Link
          href={`/dashboard/applications/${application.id}`}
          className="text-primary inline-flex items-center gap-1 text-[11px] font-medium"
        >
          Open tracker <ArrowRight className="size-3" aria-hidden="true" />
        </Link>
      </div>

      <form
        action={setApplicationStatusAction}
        className="border-border mt-3 flex items-center gap-2 border-t pt-3"
      >
        <input type="hidden" name="applicationId" value={application.id} />
        <label className="sr-only" htmlFor={`quick-status-${application.id}`}>
          Change status for {application.university.name}
        </label>
        <Select
          id={`quick-status-${application.id}`}
          name="status"
          defaultValue={application.status}
          className="h-8 py-1 text-[12px]"
        >
          {APPLICATION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {APPLICATION_STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
        <Button type="submit" size="sm" variant="outline">
          Move
        </Button>
      </form>
    </article>
  );
}

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<ApplicationsQuery>;
}) {
  const session = await requireWorkspace();
  const [applications, query] = await Promise.all([
    listApplications(session.user.id),
    searchParams,
  ]);
  const filters = parseApplicationFilters(query);
  const now = new Date();
  const { metrics, visible, groups, attention } = buildApplicationBoard(
    applications,
    filters,
    now,
  );

  const metricCards = [
    {
      label: "Tracked applications",
      value: metrics.total,
      detail: `${metrics.active} active · ${metrics.closed} closed`,
    },
    {
      label: "Due in 30 days",
      value: metrics.dueSoon + metrics.upcoming,
      detail: "From deadlines you saved",
    },
    {
      label: "Overdue",
      value: metrics.overdue,
      detail: "Active applications only",
    },
    {
      label: "Documents ready",
      value:
        metrics.linkedDocuments > 0
          ? `${metrics.completeLinkedDocuments}/${metrics.linkedDocuments}`
          : "—",
      detail:
        metrics.applicationsWithIncompleteDocuments > 0
          ? `${metrics.applicationsWithIncompleteDocuments} applications still need documents`
          : "Linked private documents",
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-muted-foreground text-[12px] font-medium tracking-wide uppercase">
            Student workspace
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.025em]">
            Applications
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-6">
            Track each university, your saved deadline, documents, and progress.
            Deadlines and statuses here are your private tracker entries, not
            catalog facts.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/calendar">
              <CalendarDays /> Calendar
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/dashboard/applications/new">
              <Plus /> Add university
            </Link>
          </Button>
        </div>
      </header>

      {applications.length === 0 ? (
        <div className="surface-card px-6 py-12 text-center">
          <h2 className="text-lg font-semibold">Start your application list</h2>
          <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm leading-6">
            Add a university from the source-verified catalog, then track its
            status, deadline, and required documents here.
          </p>
          <Button asChild className="mt-4">
            <Link href="/dashboard/applications/new">Add an application</Link>
          </Button>
        </div>
      ) : (
        <>
          <section
            aria-label="Application summary"
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          >
            {metricCards.map((card) => (
              <Card key={card.label}>
                <CardHeader className="pb-2">
                  <CardDescription>{card.label}</CardDescription>
                  <CardTitle className="text-2xl">{card.value}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-[12px]">
                    {card.detail}
                  </p>
                </CardContent>
              </Card>
            ))}
          </section>

          <section className="surface-card p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <AlertTriangle className="size-4" aria-hidden="true" />
                  Needs attention
                </h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Overdue or due within 7 days across all tracked applications.
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href="/dashboard/calendar">Open calendar</Link>
              </Button>
            </div>
            {attention.length ? (
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {attention.slice(0, 6).map((application) => (
                  <Link
                    key={application.id}
                    href={`/dashboard/applications/${application.id}`}
                    className="border-border hover:border-primary/40 flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {application.university.name}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {APPLICATION_STATUS_LABELS[application.status]}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-medium">
                        {deadlineDistanceLabel(application.deadline, now)}
                      </p>
                      <time
                        className="text-muted-foreground text-[11px]"
                        dateTime={application.deadline?.toISOString()}
                      >
                        {dateLabel(application.deadline)}
                      </time>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground mt-4 rounded-lg border border-dashed p-4 text-sm">
                No active deadline is overdue or due within 7 days.
              </p>
            )}
          </section>

          <section className="surface-card p-4 sm:p-5">
            <form
              method="get"
              action="/dashboard/applications"
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:items-end"
            >
              <label className="block space-y-1.5 text-xs font-medium">
                Search
                <Input
                  name="q"
                  defaultValue={filters.query}
                  placeholder="University, city, status, or notes"
                  maxLength={120}
                />
              </label>
              <label className="block space-y-1.5 text-xs font-medium">
                Status
                <Select name="status" defaultValue={filters.status}>
                  <option value="ALL">All statuses</option>
                  {APPLICATION_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {APPLICATION_STATUS_LABELS[status]}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block space-y-1.5 text-xs font-medium">
                Deadline
                <Select name="urgency" defaultValue={filters.urgency}>
                  {Object.entries(DEADLINE_FILTER_LABELS).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </Select>
              </label>
              <label className="block space-y-1.5 text-xs font-medium">
                Sort by
                <Select name="sort" defaultValue={filters.sort}>
                  {Object.entries(APPLICATION_SORT_LABELS).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </Select>
              </label>
              <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
                <Button type="submit" size="sm">
                  Apply
                </Button>
                {hasActiveFilters(filters) ? (
                  <Button asChild type="button" size="sm" variant="ghost">
                    <Link href="/dashboard/applications">Clear</Link>
                  </Button>
                ) : null}
              </div>
            </form>
            <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span>
                Showing {visible.length} of {applications.length} applications
              </span>
              <Badge variant="muted">Private tracker data</Badge>
            </div>
          </section>

          {visible.length ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {groups.map((group) => (
                <section
                  key={group.status}
                  aria-label={`${APPLICATION_STATUS_LABELS[group.status]} applications`}
                  className="border-border bg-muted/20 min-w-0 rounded-xl border p-3"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h2 className="text-[13px] font-semibold">
                      {APPLICATION_STATUS_LABELS[group.status]}
                    </h2>
                    <span className="text-muted-foreground bg-background rounded-full px-2 py-0.5 text-[11px]">
                      {group.items.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {group.items.length ? (
                      group.items.map((application) => (
                        <ApplicationCard
                          key={application.id}
                          application={application}
                          now={now}
                        />
                      ))
                    ) : (
                      <p className="text-muted-foreground border-border rounded-lg border border-dashed px-3 py-5 text-center text-xs">
                        No applications in this stage
                      </p>
                    )}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="surface-card px-6 py-12 text-center">
              <h2 className="text-base font-semibold">
                No applications match these filters
              </h2>
              <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm">
                Try a different status, deadline state, or search term.
              </p>
              <Button asChild size="sm" variant="outline" className="mt-4">
                <Link href="/dashboard/applications">Clear filters</Link>
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
