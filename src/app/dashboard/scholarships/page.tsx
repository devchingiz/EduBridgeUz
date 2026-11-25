import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Sparkles, Wallet } from "lucide-react";

import { ScholarshipFiltersForm } from "@/components/catalog/filters";
import { EmptyResults, Pagination } from "@/components/catalog/pagination";
import { DashboardScholarshipCard } from "@/components/dashboard/dashboard-scholarship-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireWorkspace } from "@/lib/auth/dal";
import {
  ALL_FILTER,
  dashboardScholarshipSearchHref,
  hasActiveScholarshipFilters,
  parseScholarshipFilters,
} from "@/lib/catalog/filters";
import { getCatalogOptions, listScholarships } from "@/lib/catalog/queries";
import { FUNDING_LABELS, type FundingTypeValue } from "@/lib/catalog/constants";
import { countryName } from "@/lib/data/countries";
import { degreeLabel } from "@/lib/data/fields";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Explore Scholarships",
  robots: { index: false, follow: false },
};

export default async function DashboardScholarshipsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, session] = await Promise.all([
    searchParams,
    requireWorkspace(),
  ]);
  const filters = parseScholarshipFilters(params);
  const active = hasActiveScholarshipFilters(filters);

  const [result, options] = await Promise.all([
    listScholarships(filters, session.user.id),
    getCatalogOptions(),
  ]);

  const profile = session.status.profile;
  const profileFilters = parseScholarshipFilters({});
  if (profile?.nationality) profileFilters.nationality = profile.nationality;
  if (profile?.targetDegree) profileFilters.degree = profile.targetDegree;
  if (profile?.fieldsOfStudy.length) {
    profileFilters.field = profile.fieldsOfStudy[0];
  }
  const profileReady = hasActiveScholarshipFilters(profileFilters);

  const activeChips: string[] = [];
  if (filters.q) activeChips.push(`“${filters.q}”`);
  if (filters.hostCountry !== ALL_FILTER) {
    activeChips.push(countryName(filters.hostCountry));
  }
  if (filters.funding !== ALL_FILTER) {
    activeChips.push(
      FUNDING_LABELS[filters.funding as FundingTypeValue] ?? filters.funding,
    );
  }
  if (filters.degree !== ALL_FILTER) {
    activeChips.push(degreeLabel(filters.degree));
  }
  if (filters.field !== ALL_FILTER) activeChips.push(filters.field);
  if (filters.nationality !== ALL_FILTER) {
    activeChips.push(`Nationality: ${countryName(filters.nationality)}`);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-[12px] font-medium tracking-wide uppercase">
            Funding explorer
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.025em]">
            Explore Scholarships
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-6">
            Filter source-linked funding leads and keep the ones worth chasing.
            Every record points to the provider&apos;s official rules; a match
            is a lead, never a funding guarantee.
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </header>

      {profileReady ? (
        <div className="surface-card border-primary/20 bg-accent/40 flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
              <Sparkles aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold">
                Start from your study profile
              </p>
              <p className="text-muted-foreground mt-0.5 text-[12px] leading-5">
                Apply your nationality, target degree, and first study field in
                one click. You can still adjust any filter afterwards.
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href={dashboardScholarshipSearchHref(profileFilters)}>
              Apply profile filters
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
        <aside className="lg:sticky lg:top-6">
          <ScholarshipFiltersForm
            filters={filters}
            hostCountries={options.scholarshipHostCountries}
            action="/dashboard/scholarships"
            clearHref="/dashboard/scholarships"
          />
        </aside>

        <section
          aria-labelledby="dashboard-scholarship-results"
          className="min-w-0 space-y-4"
        >
          <div className="surface-card flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="text-muted-foreground flex items-center gap-1.5 text-[10.5px] font-semibold tracking-[0.12em] uppercase">
                <Wallet aria-hidden="true" className="size-3.5" />
                Results
              </p>
              <h2
                id="dashboard-scholarship-results"
                className="mt-1 text-lg font-semibold"
              >
                {result.total === 0
                  ? "No scholarships found"
                  : `${result.total} scholarship${result.total === 1 ? "" : "s"}`}
              </h2>
              {activeChips.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {activeChips.map((chip) => (
                    <Badge key={chip} variant="muted">
                      {chip}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <p className="text-muted-foreground hidden text-[11.5px] sm:block">
                Ordered by name · No sponsored placements
              </p>
              {active ? (
                <Button asChild size="sm" variant="ghost">
                  <Link href="/dashboard/scholarships">Clear</Link>
                </Button>
              ) : null}
            </div>
          </div>

          {result.items.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {result.items.map((scholarship) => (
                <DashboardScholarshipCard
                  key={scholarship.id}
                  scholarship={scholarship}
                />
              ))}
            </div>
          ) : (
            <EmptyResults
              title="No scholarships match these filters"
              description="Try a broader nationality, degree, or field. EduBridge only lists scholarships checked against an official provider page."
              action={
                active ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href="/dashboard/scholarships">Clear filters</Link>
                  </Button>
                ) : undefined
              }
            />
          )}

          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            hrefForPage={(page) =>
              dashboardScholarshipSearchHref(filters, page)
            }
            totalLabel={`${result.total} result${result.total === 1 ? "" : "s"}`}
          />
        </section>
      </div>
    </div>
  );
}
