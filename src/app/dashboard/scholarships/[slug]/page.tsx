import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, ExternalLink, Globe } from "lucide-react";

import { FavoriteButton } from "@/components/catalog/favorite-button";
import {
  ReviewBanner,
  SourceLine,
  UnknownValue,
  VerificationBadge,
  VerificationNote,
} from "@/components/catalog/verification";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireWorkspace } from "@/lib/auth/dal";
import {
  ELIGIBILITY_LABELS,
  FUNDING_LABELS,
  REQUIREMENT_LABELS,
  type EligibilityScopeValue,
  type FundingTypeValue,
} from "@/lib/catalog/constants";
import {
  deadlineState,
  formatDeadlineLabel,
  formatDeadlineWindow,
} from "@/lib/catalog/format";
import { getScholarshipBySlug } from "@/lib/catalog/queries";
import { countryName } from "@/lib/data/countries";
import { degreeLabel } from "@/lib/data/fields";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const detail = await getScholarshipBySlug(slug);
  if (!detail) return { title: "Scholarship not found" };

  return {
    title: detail.scholarship.name,
    description: detail.scholarship.summary.slice(0, 300),
    robots: { index: false, follow: false },
  };
}

const DEADLINE_BADGE = {
  open: { label: "Open now", variant: "success" as const },
  upcoming: { label: "Upcoming", variant: "brand" as const },
  closed: { label: "Closed", variant: "muted" as const },
  unknown: { label: "Check source", variant: "outline" as const },
};

export default async function DashboardScholarshipDetailPage({
  params,
}: PageProps) {
  const { slug } = await params;
  const session = await requireWorkspace();
  const detail = await getScholarshipBySlug(slug, session.user.id);
  if (!detail) notFound();

  const { scholarship, requirements, deadlines, isFavorite } = detail;
  const detailUrl = `/dashboard/scholarships/${scholarship.slug}`;

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb">
        <Link
          href="/dashboard/scholarships"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-[12.5px]"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          All scholarships
        </Link>
      </nav>

      <header className="surface-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.1em] uppercase">
              {scholarship.providerName}
              {scholarship.hostCountryCode
                ? ` · ${countryName(scholarship.hostCountryCode)}`
                : " · Multiple host countries"}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-balance sm:text-3xl">
              {scholarship.name}
            </h1>
          </div>
          <VerificationBadge status={scholarship.provenance.status} />
        </div>

        <p className="text-muted-foreground mt-4 max-w-2xl text-[13px] leading-6">
          {scholarship.summary}
        </p>

        <div className="mt-5 flex flex-wrap gap-1.5">
          <Badge variant="brand">
            {FUNDING_LABELS[scholarship.fundingType as FundingTypeValue]}
          </Badge>
          {scholarship.degreeLevels.map((degree) => (
            <Badge key={degree} variant="muted">
              {degreeLabel(degree)}
            </Badge>
          ))}
          <Badge variant="outline">
            {
              ELIGIBILITY_LABELS[
                scholarship.nationalityScope as EligibilityScopeValue
              ]
            }
          </Badge>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a
              href={scholarship.providerUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              <Globe aria-hidden="true" className="size-4" />
              Provider website
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </a>
          </Button>
          {scholarship.provenance.source ? (
            <Button asChild variant="ghost" size="sm">
              <a
                href={scholarship.provenance.source.url}
                target="_blank"
                rel="noreferrer noopener"
              >
                Official rules
                <ExternalLink aria-hidden="true" className="size-3.5" />
              </a>
            </Button>
          ) : null}
          <FavoriteButton
            entityType="SCHOLARSHIP"
            id={scholarship.id}
            saved={isFavorite}
            signedIn
            returnTo={detailUrl}
          />
        </div>

        <div className="border-border mt-5 space-y-1.5 border-t pt-4">
          <SourceLine citation={scholarship.provenance.source} />
          <VerificationNote
            status={scholarship.provenance.status}
            verifiedAt={scholarship.provenance.verifiedAt}
            nextReviewAt={scholarship.provenance.nextReviewAt}
          />
        </div>
      </header>

      <ReviewBanner
        status={scholarship.provenance.status}
        entityLabel="scholarship"
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="min-w-0 space-y-7">
          <section aria-labelledby="dashboard-scholarship-eligibility">
            <h2
              id="dashboard-scholarship-eligibility"
              className="text-lg font-semibold tracking-[-0.02em]"
            >
              Eligibility
            </h2>
            <div className="surface-card mt-3 space-y-4 p-5">
              <div>
                <p className="text-muted-foreground text-[10.5px] font-semibold tracking-[0.1em] uppercase">
                  Nationality
                </p>
                <p className="mt-1 text-[13px] leading-6">
                  {
                    ELIGIBILITY_LABELS[
                      scholarship.nationalityScope as EligibilityScopeValue
                    ]
                  }
                  {scholarship.eligibleNationalities.length > 0 ? (
                    <>
                      {": "}
                      {scholarship.eligibleNationalities
                        .map((code) => countryName(code))
                        .join(", ")}
                      .{" "}
                      <span className="text-muted-foreground">
                        This is not necessarily the complete list; check the
                        provider&apos;s page.
                      </span>
                    </>
                  ) : null}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-[10.5px] font-semibold tracking-[0.1em] uppercase">
                  Field of study
                </p>
                <p className="mt-1 text-[13px] leading-6">
                  {scholarship.fieldScope === "ALL" ? (
                    "All fields"
                  ) : scholarship.fields.length > 0 ? (
                    scholarship.fields.join(", ")
                  ) : (
                    <UnknownValue />
                  )}
                </p>
              </div>
              <p className="text-muted-foreground border-border border-t pt-3 text-[11.5px] leading-5">
                Eligibility fields describe what the provider states. They are
                not an assessment of your application, and EduBridge cannot
                guarantee funding.
              </p>
            </div>
          </section>

          <section aria-labelledby="dashboard-scholarship-requirements">
            <h2
              id="dashboard-scholarship-requirements"
              className="text-lg font-semibold tracking-[-0.02em]"
            >
              Requirements
            </h2>
            {requirements.length === 0 ? (
              <div className="surface-card mt-3 px-6 py-8">
                <p className="text-[13px] font-medium">
                  No requirements have been recorded yet
                </p>
                <p className="text-muted-foreground mt-1.5 text-[12.5px] leading-6">
                  The provider&apos;s official rules are still the authoritative
                  source.
                </p>
              </div>
            ) : (
              <ul className="mt-3 space-y-3">
                {requirements.map((requirement) => (
                  <li key={requirement.id} className="surface-card p-4 sm:p-5">
                    <div className="flex flex-wrap items-start gap-2">
                      <Badge variant="muted">
                        {REQUIREMENT_LABELS[requirement.kind]}
                      </Badge>
                      <p className="min-w-0 flex-1 text-[13px] leading-6">
                        {requirement.summary}
                      </p>
                    </div>
                    <SourceLine
                      citation={requirement.provenance.source}
                      className="mt-2"
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="dashboard-scholarship-deadlines">
            <div className="flex items-center gap-2">
              <CalendarClock
                aria-hidden="true"
                className="text-muted-foreground size-4"
              />
              <h2
                id="dashboard-scholarship-deadlines"
                className="text-lg font-semibold tracking-[-0.02em]"
              >
                Key dates
              </h2>
            </div>
            {deadlines.length === 0 ? (
              <div className="surface-card mt-3 px-6 py-8">
                <p className="text-[13px] font-medium">
                  No dates have been verified
                </p>
                <p className="text-muted-foreground mt-1.5 text-[12.5px] leading-6">
                  Check the provider&apos;s page for the current application
                  window.
                </p>
              </div>
            ) : (
              <ul className="mt-3 space-y-3">
                {deadlines.map((deadline) => {
                  const state = DEADLINE_BADGE[deadlineState(deadline)];
                  const window = formatDeadlineWindow(deadline);
                  return (
                    <li key={deadline.id} className="surface-card p-4 sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold">
                            {deadline.cycle}
                          </p>
                          <p className="mt-1 text-[13px]">
                            {window ?? formatDeadlineLabel(deadline)}
                          </p>
                        </div>
                        <Badge variant={state.variant}>{state.label}</Badge>
                      </div>
                      {deadline.note ? (
                        <p className="text-muted-foreground mt-2 text-[12.5px] leading-5">
                          {deadline.note}
                        </p>
                      ) : null}
                      <SourceLine
                        citation={deadline.provenance.source}
                        className="mt-2"
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <aside className="surface-card space-y-4 p-5 lg:sticky lg:top-6">
          <div>
            <p className="text-[13px] font-semibold">Before you apply</p>
            <p className="text-muted-foreground mt-1.5 text-[12px] leading-5">
              Read the provider&apos;s official rules. Eligibility and deadlines
              can change, and some criteria are not captured here.
            </p>
          </div>
          <div className="border-border space-y-2 border-t pt-3">
            <p className="text-muted-foreground text-[10.5px] font-semibold tracking-[0.1em] uppercase">
              Next steps
            </p>
            <Link
              href="/dashboard/profile"
              className="text-foreground block text-[12.5px] underline underline-offset-2"
            >
              Check your study profile
            </Link>
            <Link
              href="/dashboard/applications"
              className="text-foreground block text-[12.5px] underline underline-offset-2"
            >
              Track this application
            </Link>
            <Link
              href="/dashboard/documents"
              className="text-foreground block text-[12.5px] underline underline-offset-2"
            >
              Prepare documents
            </Link>
          </div>
          <div className="border-border space-y-2 border-t pt-3">
            <p className="text-muted-foreground text-[10.5px] font-semibold tracking-[0.1em] uppercase">
              Provider
            </p>
            <a
              href={scholarship.providerUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-foreground inline-flex items-center gap-1 text-[12.5px] font-medium underline underline-offset-2"
            >
              {scholarship.providerName}
              <ExternalLink aria-hidden="true" className="size-3" />
            </a>
          </div>
          <SourceLine citation={scholarship.provenance.source} />
        </aside>
      </div>
    </div>
  );
}
