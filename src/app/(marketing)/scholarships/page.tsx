import type { Metadata } from "next";
import Link from "next/link";

import { ScholarshipCard } from "@/components/catalog/cards";
import { ScholarshipFiltersForm } from "@/components/catalog/filters";
import { EmptyResults, Pagination } from "@/components/catalog/pagination";
import { Button } from "@/components/ui/button";
import {
  hasActiveScholarshipFilters,
  parseScholarshipFilters,
  scholarshipSearchHref,
} from "@/lib/catalog/filters";
import { getCatalogOptions, listScholarships } from "@/lib/catalog/queries";
import { siteConfig } from "@/lib/site";
import { getCurrentUser } from "@/lib/auth/dal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Scholarship search",
  description:
    "Search source-linked scholarships by host country, funding type, degree level, field, and nationality. Eligibility is explained, never guaranteed.",
  alternates: { canonical: "/scholarships" },
};

export default async function ScholarshipsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseScholarshipFilters(await searchParams);
  const session = await getCurrentUser();
  const [result, options] = await Promise.all([
    listScholarships(filters, session?.id),
    getCatalogOptions(),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Scholarship search",
    url: `${siteConfig.url}/scholarships`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: result.total,
      itemListElement: result.items.map((scholarship, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${siteConfig.url}/scholarships/${scholarship.slug}`,
        name: scholarship.name,
      })),
    },
  };

  return (
    <div className="site-container py-10 sm:py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <div className="max-w-2xl">
        <p className="eyebrow">Funding</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-balance sm:text-4xl">
          Scholarships you can actually check
        </h1>
        <p className="text-muted-foreground mt-3 text-[13.5px] leading-6">
          Each scholarship links to the provider&apos;s official rules. We show
          what the provider states and mark anything we could not verify. A
          match here is a lead, not a funding guarantee.
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
        <aside className="lg:sticky lg:top-24">
          <ScholarshipFiltersForm
            filters={filters}
            hostCountries={options.scholarshipHostCountries}
          />
        </aside>

        <section aria-labelledby="scholarship-results" className="min-w-0">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <h2
              id="scholarship-results"
              className="text-[13px] font-semibold tracking-wide uppercase"
            >
              {result.total === 0
                ? "No scholarships found"
                : `${result.total} scholarship${result.total === 1 ? "" : "s"}`}
            </h2>
            <p className="text-muted-foreground text-[11.5px]">
              Ordered by name. No sponsored placements.
            </p>
          </div>

          {result.items.length === 0 ? (
            <EmptyResults
              title="No scholarships match these filters"
              description="Try a different nationality, field, or funding type. We only list scholarships that a reviewer has checked against an official provider page."
              action={
                hasActiveScholarshipFilters(filters) ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href="/scholarships">Clear filters</Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {result.items.map((scholarship) => (
                <ScholarshipCard
                  key={scholarship.id}
                  scholarship={scholarship}
                  signedIn={Boolean(session)}
                />
              ))}
            </div>
          )}

          <div className="mt-6">
            <Pagination
              page={result.page}
              pageCount={result.pageCount}
              hrefForPage={(page) => scholarshipSearchHref(filters, page)}
              totalLabel={`${result.total} result${result.total === 1 ? "" : "s"}`}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
