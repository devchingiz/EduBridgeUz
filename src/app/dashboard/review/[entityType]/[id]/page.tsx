import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarClock,
  ClipboardCheck,
  History,
  ListChecks,
  Trash2,
  Wallet,
} from "lucide-react";

import {
  addDeadlineAction,
  addRequirementAction,
  addTuitionAction,
  decisionAction,
  removeFactAction,
  updateRecordAction,
} from "@/app/dashboard/review/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DeadlineForm,
  DecisionForm,
  RecordEditForm,
  RequirementForm,
  TuitionForm,
} from "@/components/review/record-forms";
import { requireRole } from "@/lib/auth/dal";
import {
  CATALOG_ENTITY_LABELS,
  CATALOG_ENTITY_TYPES,
  PUBLIC_VISIBLE_STATUSES,
  REQUIREMENT_LABELS,
  REVIEW_DECISION_LABELS,
  VERIFICATION_LABELS,
  type CatalogEntityTypeValue,
  type RequirementKindValue,
  type ReviewDecisionValue,
  type VerificationStatusValue,
} from "@/lib/catalog/constants";
import { verificationBadgeVariant, formatMonthDay } from "@/lib/catalog/format";
import {
  getEntityReviews,
  getReviewRecord,
  listUniversityOptions,
  type ReviewRecord,
} from "@/lib/catalog/queries";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = {
  title: "Review a catalog record",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ entityType: string; id: string }>;
};

function parseEntityType(value: string): CatalogEntityTypeValue | null {
  const upper = value.toUpperCase();
  return (CATALOG_ENTITY_TYPES as readonly string[]).includes(upper)
    ? (upper as CatalogEntityTypeValue)
    : null;
}

/** The public URL for a record, when it is currently visible. */
function publicHref(record: ReviewRecord): string | null {
  if (record.entityType === "UNIVERSITY") {
    return `/universities/${record.slug}`;
  }
  if (record.entityType === "SCHOLARSHIP") {
    return `/scholarships/${record.slug}`;
  }
  const university = record.programs?.[0];
  return university
    ? `/universities/${university.slug}/programs/${record.slug}`
    : null;
}

function orNull(value: string): string | null {
  return value.trim().length > 0 ? value : null;
}

function RemoveFactForm({
  factType,
  factId,
  redirectTo,
  label,
}: {
  factType: "requirement" | "tuition" | "deadline";
  factId: string;
  redirectTo: string;
  label: string;
}) {
  return (
    <form action={removeFactAction} className="shrink-0">
      <input type="hidden" name="factType" value={factType} />
      <input type="hidden" name="factId" value={factId} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
      >
        <Trash2 aria-hidden="true" className="size-3.5" />
        <span className="sr-only">Remove {label}</span>
        Remove
      </Button>
    </form>
  );
}

export default async function ReviewRecordPage({ params }: PageProps) {
  await requireRole(["REVIEWER", "ADMIN", "SUPER_ADMIN"]);

  const { entityType: rawType, id } = await params;
  const entityType = parseEntityType(rawType);
  if (!entityType) notFound();

  const [record, reviews, universities] = await Promise.all([
    getReviewRecord(entityType, id),
    getEntityReviews(entityType, id),
    entityType === "PROGRAM" ? listUniversityOptions() : Promise.resolve([]),
  ]);
  if (!record) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const redirectTo = `/dashboard/review/${entityType.toLowerCase()}/${id}`;
  const publicLink = (
    PUBLIC_VISIBLE_STATUSES as readonly VerificationStatusValue[]
  ).includes(record.status)
    ? publicHref(record)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/review"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-[12.5px]"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          Review queue
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-muted-foreground text-[12px] font-medium tracking-wide uppercase">
              {CATALOG_ENTITY_LABELS[entityType]} · {record.slug}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.025em]">
              {record.name}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={verificationBadgeVariant(record.status)}>
              {VERIFICATION_LABELS[record.status]}
            </Badge>
            {publicLink ? (
              <Button asChild variant="outline" size="sm">
                <Link href={publicLink}>
                  View public page
                  <ArrowUpRight aria-hidden="true" className="size-3.5" />
                </Link>
              </Button>
            ) : (
              <span className="text-muted-foreground text-[11.5px]">
                Hidden from the public catalog
              </span>
            )}
          </div>
        </div>

        <p className="text-muted-foreground mt-2 text-[12px]">
          Last verified{" "}
          {record.lastVerifiedAt ? formatDate(record.lastVerifiedAt) : "never"}{" "}
          · Next review{" "}
          {record.nextReviewAt
            ? formatDate(record.nextReviewAt)
            : "not scheduled"}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Record fields and source</CardTitle>
              <CardDescription>
                Editing without marking the record verified returns it to the
                review queue.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RecordEditForm
                record={record}
                action={updateRecordAction}
                universities={universities}
                today={today}
              />
            </CardContent>
          </Card>

          {entityType !== "UNIVERSITY" ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListChecks aria-hidden="true" className="size-4" />
                  Requirements
                </CardTitle>
                <CardDescription>
                  {record.requirements.length} requirement fact
                  {record.requirements.length === 1 ? "" : "s"} recorded.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {record.requirements.length === 0 ? (
                  <p className="text-muted-foreground text-[12.5px]">
                    No requirements recorded yet.
                  </p>
                ) : (
                  <ul className="divide-border divide-y">
                    {record.requirements.map((requirement) => (
                      <li
                        key={requirement.id}
                        className="flex flex-wrap items-start gap-2 py-3 first:pt-0"
                      >
                        <Badge variant="muted">
                          {REQUIREMENT_LABELS[
                            requirement.kind as RequirementKindValue
                          ] ?? requirement.kind}
                        </Badge>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] leading-5">
                            {requirement.summary}
                          </p>
                          <p className="text-muted-foreground mt-1 text-[11px]">
                            {requirement.verifiedAt
                              ? `Source checked ${formatDate(requirement.verifiedAt)}`
                              : "Source has no verification date"}
                          </p>
                        </div>
                        <RemoveFactForm
                          factType="requirement"
                          factId={requirement.id}
                          redirectTo={redirectTo}
                          label="requirement"
                        />
                      </li>
                    ))}
                  </ul>
                )}
                <div className="border-border border-t pt-4">
                  <RequirementForm
                    entityType={entityType}
                    id={id}
                    action={addRequirementAction}
                  />
                </div>
              </CardContent>
            </Card>
          ) : null}

          {entityType === "PROGRAM" ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet aria-hidden="true" className="size-4" />
                  Tuition facts
                </CardTitle>
                <CardDescription>
                  Amounts are stored in minor units of the stated currency.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {record.tuition.length === 0 ? (
                  <p className="text-muted-foreground text-[12.5px]">
                    No tuition amount is recorded. Leave it empty rather than
                    estimate.
                  </p>
                ) : (
                  <ul className="divide-border divide-y">
                    {record.tuition.map((fact) => (
                      <li
                        key={fact.id}
                        className="flex flex-wrap items-start gap-2 py-3 first:pt-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium">
                            {fact.amount} {fact.currency}{" "}
                            <span className="text-muted-foreground font-normal">
                              {fact.period}
                            </span>
                          </p>
                          <p className="text-muted-foreground mt-0.5 text-[11.5px]">
                            {fact.applicantGroup || "All applicants"}
                            {fact.note ? ` · ${fact.note}` : ""}
                          </p>
                        </div>
                        <RemoveFactForm
                          factType="tuition"
                          factId={fact.id}
                          redirectTo={redirectTo}
                          label="tuition fact"
                        />
                      </li>
                    ))}
                  </ul>
                )}
                <div className="border-border border-t pt-4">
                  <TuitionForm id={id} action={addTuitionAction} />
                </div>
              </CardContent>
            </Card>
          ) : null}

          {entityType !== "UNIVERSITY" ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarClock aria-hidden="true" className="size-4" />
                  Deadlines
                </CardTitle>
                <CardDescription>
                  Use an exact date only when the source publishes a year.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {record.deadlines.length === 0 ? (
                  <p className="text-muted-foreground text-[12.5px]">
                    No deadline is recorded.
                  </p>
                ) : (
                  <ul className="divide-border divide-y">
                    {record.deadlines.map((deadline) => (
                      <li
                        key={deadline.id}
                        className="flex flex-wrap items-start gap-2 py-3 first:pt-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium">
                            {deadline.cycle}
                            {deadline.applicantGroup ? (
                              <span className="text-muted-foreground font-normal">
                                {" "}
                                · {deadline.applicantGroup}
                              </span>
                            ) : null}
                          </p>
                          <p className="text-muted-foreground mt-0.5 text-[11.5px]">
                            {[
                              orNull(deadline.opensOn)
                                ? formatDate(deadline.opensOn)
                                : formatMonthDay(deadline.opensMonthDay),
                              orNull(deadline.deadlineOn)
                                ? formatDate(deadline.deadlineOn)
                                : formatMonthDay(deadline.deadlineMonthDay),
                            ]
                              .filter(Boolean)
                              .join(" → ") || "No date; see note"}
                            {deadline.note ? ` · ${deadline.note}` : ""}
                          </p>
                        </div>
                        <RemoveFactForm
                          factType="deadline"
                          factId={deadline.id}
                          redirectTo={redirectTo}
                          label="deadline"
                        />
                      </li>
                    ))}
                  </ul>
                )}
                <div className="border-border border-t pt-4">
                  <DeadlineForm
                    entityType={entityType}
                    id={id}
                    action={addDeadlineAction}
                  />
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck aria-hidden="true" className="size-4" />
                Decision
              </CardTitle>
              <CardDescription>
                Approving requires a verified source date. Restore returns the
                record to review, never straight to verified.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DecisionForm
                entityType={entityType}
                id={id}
                action={decisionAction}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History aria-hidden="true" className="size-4" />
                Review history
              </CardTitle>
              <CardDescription>Append-only. Newest first.</CardDescription>
            </CardHeader>
            <CardContent>
              {reviews.length === 0 ? (
                <p className="text-muted-foreground text-[12.5px]">
                  No decisions recorded yet.
                </p>
              ) : (
                <ul className="divide-border divide-y">
                  {reviews.map((review) => (
                    <li key={review.id} className="py-2.5 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[12.5px] font-medium">
                          {REVIEW_DECISION_LABELS[
                            review.decision as ReviewDecisionValue
                          ] ?? review.decision}
                        </p>
                        <p className="text-muted-foreground text-[11px]">
                          {formatDateTime(review.createdAt)}
                        </p>
                      </div>
                      <p className="text-muted-foreground mt-0.5 text-[11.5px]">
                        {review.reviewerName ?? "System"} ·{" "}
                        {review.fromStatus ?? "new"} → {review.toStatus}
                      </p>
                      {review.note ? (
                        <p className="text-muted-foreground mt-1 text-[11.5px] leading-5">
                          {review.note}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
