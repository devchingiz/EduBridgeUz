import { ArrowRight, CalendarClock, Wallet } from "lucide-react";
import Link from "next/link";

import { VerificationBadge } from "@/components/catalog/verification";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FUNDING_LABELS, type FundingTypeValue } from "@/lib/catalog/constants";
import type { ScholarshipListItem } from "@/lib/catalog/queries";
import { countryName } from "@/lib/data/countries";

export function DashboardScholarships({
  items,
  total,
  searchHref,
  personalized,
}: {
  items: ScholarshipListItem[];
  total: number;
  searchHref: string;
  personalized: boolean;
}) {
  const filteredEmpty = personalized && total === 0;

  return (
    <section className="space-y-4" aria-labelledby="dashboard-scholarships">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
            Funding
          </p>
          <h2
            id="dashboard-scholarships"
            className="mt-1 text-lg font-semibold tracking-[-0.02em]"
          >
            Scholarship matches
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {personalized
              ? "Source-linked leads filtered by your study profile."
              : "Source-linked funding leads from the verified catalog."}
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href={searchHref}>
            View all scholarships <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet aria-hidden="true" className="size-4" />
            {personalized ? "Matched to your profile" : "Explore funding"}
          </CardTitle>
          <CardDescription>
            {total > 0
              ? personalized
                ? `${total} source-checked scholarship${total === 1 ? "" : "s"} ${total === 1 ? "matches" : "match"} your study profile. Open official rules before applying.`
                : `${total} source-checked scholarship${total === 1 ? "" : "s"} in the catalog. Open official rules before applying.`
              : filteredEmpty
                ? "No scholarships match these profile filters yet. Browse the full catalog or adjust your study profile."
                : "No scholarships are published yet. Check back after the next catalog review."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length ? (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((scholarship) => (
                <li key={scholarship.id}>
                  <Link
                    href={`/dashboard/scholarships/${scholarship.slug}`}
                    className="surface-card hover:border-primary/30 group flex h-full flex-col gap-3 p-4 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13px] leading-5 font-semibold">
                          {scholarship.name}
                        </p>
                        <p className="text-muted-foreground mt-0.5 truncate text-[11.5px]">
                          {scholarship.providerName}
                        </p>
                      </div>
                      <VerificationBadge status={scholarship.status} />
                    </div>

                    <p className="text-muted-foreground line-clamp-2 text-[12px] leading-5">
                      {scholarship.summary}
                    </p>

                    <div className="mt-auto flex flex-wrap gap-1.5">
                      <Badge variant="brand">
                        {FUNDING_LABELS[
                          scholarship.fundingType as FundingTypeValue
                        ] ?? "Funding"}
                      </Badge>
                      {scholarship.hostCountryCode ? (
                        <Badge variant="muted">
                          {countryName(scholarship.hostCountryCode)}
                        </Badge>
                      ) : null}
                      {scholarship.deadlineCount > 0 ? (
                        <Badge variant="outline">
                          <CalendarClock aria-hidden="true" />
                          {scholarship.deadlineCount}
                          {scholarship.deadlineCount === 1
                            ? " deadline"
                            : " deadlines"}
                        </Badge>
                      ) : (
                        <Badge variant="outline">No dated cycle</Badge>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="border-border bg-muted/30 rounded-xl border border-dashed p-6 text-center">
              <p className="text-sm font-medium">No matches yet</p>
              <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-[12.5px] leading-5">
                {filteredEmpty
                  ? "No scholarships match this nationality, degree, and field combination yet. Browse the full catalog or update your study profile."
                  : "Add your nationality, degree, and field in your study profile, or browse the full scholarship catalog for other leads."}
              </p>
              <Button asChild size="sm" className="mt-4">
                <Link href={searchHref}>Browse scholarships</Link>
              </Button>
            </div>
          )}

          <p className="text-muted-foreground mt-4 text-[11.5px] leading-5">
            A match is a lead, not a funding guarantee. Always confirm
            eligibility, amounts, and deadlines with the provider.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
