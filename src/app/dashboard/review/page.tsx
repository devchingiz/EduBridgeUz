import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Database,
  FileWarning,
  Plus,
  RefreshCw,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { requireRole } from "@/lib/auth/dal";
import {
  CATALOG_ENTITY_LABELS,
  REVIEW_DECISION_LABELS,
  VERIFICATION_LABELS,
  type CatalogEntityTypeValue,
  type ReviewDecisionValue,
  type VerificationStatusValue,
} from "@/lib/catalog/constants";
import {
  getDataQualityReport,
  getReviewQueue,
  listReviewRecords,
} from "@/lib/catalog/queries";
import { formatDate, formatDateTime } from "@/lib/format";
import { runSweepAction } from "@/app/dashboard/review/actions";

export const metadata: Metadata = {
  title: "Catalog review",
  robots: { index: false, follow: false },
};

const IMPORT_TYPES: CatalogEntityTypeValue[] = [
  "UNIVERSITY",
  "PROGRAM",
  "SCHOLARSHIP",
];

function reviewHref(entityType: CatalogEntityTypeValue, id: string): string {
  return `/dashboard/review/${entityType.toLowerCase()}/${id}`;
}

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(["REVIEWER", "ADMIN"]);
  const params = await searchParams;
  const [queue, quality, records] = await Promise.all([
    getReviewQueue(),
    getDataQualityReport(),
    listReviewRecords(),
  ]);

  const stats = [
    {
      label: "Needs review",
      value: queue.counts.needsReview,
      detail: "Visible with a warning banner",
    },
    {
      label: "Partially verified",
      value: queue.counts.partiallyVerified,
      detail: "Some fields are sourced, others unavailable",
    },
    {
      label: "Unverified",
      value: queue.counts.unverified,
      detail: "Hidden from the public catalog",
    },
    {
      label: "Expired",
      value: queue.counts.expired,
      detail: "Hidden until restored",
    },
    {
      label: "Citations without a date",
      value: queue.counts.citationsWithoutVerification,
      detail: "Cannot support a verified claim",
    },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-muted-foreground text-[12px] font-medium tracking-wide uppercase">
            Staff workspace
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.025em]">
            Catalog review
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-6">
            Every published fact needs an official source and the date a human
            checked it. Import a record, re-verify it, or move it out of the
            public catalog.
          </p>
        </div>
        <form action={runSweepAction}>
          <Button type="submit" variant="outline" size="sm">
            <RefreshCw aria-hidden="true" className="size-4" />
            Run expiry sweep
          </Button>
        </form>
      </div>

      {params.swept === "1" ? (
        <Alert variant="success">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4" />
          <span>Expiry sweep finished. Stale records are now flagged.</span>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {IMPORT_TYPES.map((type) => (
          <Button key={type} asChild size="sm" variant="outline">
            <Link href={`/dashboard/review/new?type=${type}`}>
              <Plus aria-hidden="true" className="size-4" />
              Import {CATALOG_ENTITY_LABELS[type].toLowerCase()}
            </Link>
          </Button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {stat.value.toLocaleString("en")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-[12px]">{stat.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {quality.factsWithoutVerifiedSource > 0 ||
      quality.recordsWithExpiredReview > 0 ? (
        <Alert variant="warning">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4" />
          <span>
            {quality.recordsWithExpiredReview} record(s) are past their review
            window and {quality.factsWithoutVerifiedSource} verified fact(s)
            reference a citation without a verification date. Run the expiry
            sweep and update the affected sources.
          </span>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Review queue</CardTitle>
          <CardDescription>
            Oldest updates first. {queue.items.length} record(s) need attention.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {queue.items.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nothing is waiting for review.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-left text-[12.5px]">
                <thead>
                  <tr className="border-border text-muted-foreground border-b text-[11px] font-medium tracking-wide uppercase">
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Record
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Type
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Status
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Verified
                    </th>
                    <th scope="col" className="py-2 font-medium">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {queue.items.map((item) => (
                    <tr key={`${item.entityType}-${item.id}`}>
                      <td className="py-2.5 pr-4">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-muted-foreground text-[11.5px]">
                          {item.context ?? item.slug}
                        </p>
                      </td>
                      <td className="text-muted-foreground py-2.5 pr-4 whitespace-nowrap">
                        {CATALOG_ENTITY_LABELS[item.entityType]}
                      </td>
                      <td className="py-2.5 pr-4 whitespace-nowrap">
                        <Badge
                          variant={
                            item.status === "NEEDS_REVIEW" ||
                            item.status === "PARTIALLY_VERIFIED"
                              ? "warning"
                              : item.status === "EXPIRED"
                                ? "muted"
                                : "outline"
                          }
                        >
                          {VERIFICATION_LABELS[item.status]}
                        </Badge>
                      </td>
                      <td className="text-muted-foreground py-2.5 pr-4 whitespace-nowrap">
                        {item.lastVerifiedAt
                          ? formatDate(item.lastVerifiedAt)
                          : "Never"}
                      </td>
                      <td className="py-2.5 whitespace-nowrap">
                        <Link
                          href={reviewHref(item.entityType, item.id)}
                          className="text-primary inline-flex items-center gap-1 font-medium hover:underline hover:underline-offset-2"
                        >
                          Open
                          <ArrowUpRight
                            aria-hidden="true"
                            className="size-3.5"
                          />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All catalog records</CardTitle>
          <CardDescription>
            Open any record to re-check its facts, edit a field, or change its
            status. Sorted by name; {records.length} record(s) in total.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No catalog records exist yet. Import one to get started.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-left text-[12.5px]">
                <thead>
                  <tr className="border-border text-muted-foreground border-b text-[11px] font-medium tracking-wide uppercase">
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Record
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Type
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Status
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Next review
                    </th>
                    <th scope="col" className="py-2 font-medium">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {records.map((item) => (
                    <tr key={`${item.entityType}-${item.id}`}>
                      <td className="py-2.5 pr-4">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-muted-foreground text-[11.5px]">
                          {item.context ?? item.slug}
                        </p>
                      </td>
                      <td className="text-muted-foreground py-2.5 pr-4 whitespace-nowrap">
                        {CATALOG_ENTITY_LABELS[item.entityType]}
                      </td>
                      <td className="py-2.5 pr-4 whitespace-nowrap">
                        <Badge
                          variant={
                            item.status === "VERIFIED"
                              ? "success"
                              : item.status === "NEEDS_REVIEW"
                                ? "warning"
                                : "muted"
                          }
                        >
                          {VERIFICATION_LABELS[item.status]}
                        </Badge>
                      </td>
                      <td className="text-muted-foreground py-2.5 pr-4 whitespace-nowrap">
                        {item.nextReviewAt
                          ? formatDate(item.nextReviewAt)
                          : "Not scheduled"}
                      </td>
                      <td className="py-2.5 whitespace-nowrap">
                        <Link
                          href={reviewHref(item.entityType, item.id)}
                          className="text-primary inline-flex items-center gap-1 font-medium hover:underline hover:underline-offset-2"
                        >
                          Open
                          <ArrowUpRight
                            aria-hidden="true"
                            className="size-3.5"
                          />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database aria-hidden="true" className="size-4" />
              Data quality
            </CardTitle>
            <CardDescription>
              Generated {formatDateTime(quality.generatedAt)}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead>
                  <tr className="border-border text-muted-foreground border-b text-[11px] font-medium tracking-wide uppercase">
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Type
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Verified
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Review
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Partial
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Unverified
                    </th>
                    <th scope="col" className="py-2 font-medium">
                      Expired
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {(
                    Object.keys(
                      quality.statusCounts,
                    ) as CatalogEntityTypeValue[]
                  ).map((type) => {
                    const counts = quality.statusCounts[type];
                    return (
                      <tr key={type}>
                        <td className="py-2 pr-4 font-medium">
                          {CATALOG_ENTITY_LABELS[type]}
                        </td>
                        {(
                          [
                            "VERIFIED",
                            "NEEDS_REVIEW",
                            "PARTIALLY_VERIFIED",
                            "UNVERIFIED",
                            "EXPIRED",
                          ] as VerificationStatusValue[]
                        ).map((status) => (
                          <td
                            key={status}
                            className="text-muted-foreground py-2 pr-3 tabular-nums"
                          >
                            {counts[status]}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="border-border space-y-2 border-t pt-3 text-[12.5px]">
              <p>
                <span className="font-medium">{quality.verifiedRecords}</span>{" "}
                verified record(s) across the catalog.
              </p>
              <p>
                <span className="font-medium">
                  {quality.recordsWithExpiredReview}
                </span>{" "}
                record(s) past their review window.
              </p>
              <p>
                <span className="font-medium">
                  {quality.citationsWithoutVerification}
                </span>{" "}
                citation(s) without a verification date.
              </p>
            </div>

            <div className="border-border border-t pt-3">
              <p className="text-muted-foreground mb-2 text-[11px] font-medium tracking-wide uppercase">
                Coverage
              </p>
              {quality.coverage.length === 0 ? (
                <p className="text-muted-foreground text-[12.5px]">
                  No countries are covered yet.
                </p>
              ) : (
                <ul className="space-y-1 text-[12.5px]">
                  {quality.coverage.map((row) => (
                    <li
                      key={row.countryCode}
                      className="flex justify-between gap-3"
                    >
                      <span>{row.countryCode}</span>
                      <span className="text-muted-foreground">
                        {row.universities} universit
                        {row.universities === 1 ? "y" : "ies"} · {row.programs}{" "}
                        program{row.programs === 1 ? "" : "s"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileWarning aria-hidden="true" className="size-4" />
              Recent decisions
            </CardTitle>
            <CardDescription>
              Append-only reviewer history. Newest first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {queue.recentReviews.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No review decisions recorded yet.
              </p>
            ) : (
              <ul className="divide-border divide-y">
                {queue.recentReviews.map((review) => (
                  <li key={review.id} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[12.5px] font-medium">
                        <Link
                          href={reviewHref(
                            review.entityType as CatalogEntityTypeValue,
                            review.entityId,
                          )}
                          className="hover:text-primary hover:underline hover:underline-offset-2"
                        >
                          {REVIEW_DECISION_LABELS[
                            review.decision as ReviewDecisionValue
                          ] ?? review.decision}
                        </Link>
                        <span className="text-muted-foreground font-normal">
                          {" "}
                          · {review.entityType}
                        </span>
                      </p>
                      <p className="text-muted-foreground text-[11.5px]">
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
  );
}
