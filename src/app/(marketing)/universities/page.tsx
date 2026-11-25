import type { Metadata } from "next";
import Link from "next/link";

import { UniversityCard } from "@/components/catalog/cards";
import { UniversityFiltersForm } from "@/components/catalog/filters";
import { EmptyResults, Pagination } from "@/components/catalog/pagination";
import { Button } from "@/components/ui/button";
import {
  hasActiveUniversityFilters,
  parseUniversityFilters,
  universitySearchHref,
} from "@/lib/catalog/filters";
import { getCatalogOptions, listUniversities } from "@/lib/catalog/queries";
import { siteConfig } from "@/lib/site";
import { getCurrentUser } from "@/lib/auth/dal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "University catalog",
  description:
    "Browse universities with source-linked program facts. Every published requirement, tuition figure, and deadline carries an official source and a verification date.",
  alternates: { canonical: "/universities" },
};

export default async function UniversitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseUniversityFilters(await searchParams);
  const session = await getCurrentUser();
  const [result, options] = await Promise.all([
    listUniversities(filters, session?.id),
    getCatalogOptions(),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "University catalog",
    url: `${siteConfig.url}/universities`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: result.total,
      itemListElement: result.items.map((university, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${siteConfig.url}/universities/${university.slug}`,
        name: university.name,
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
        <p className="eyebrow">Catalog</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-balance sm:text-4xl">
          Universities, with their sources attached
        </h1>
        <p className="text-muted-foreground mt-3 text-[13.5px] leading-6">
          We publish only records a reviewer has checked against an official
          page. Where a university does not state a tuition figure, deadline, or
          requirement, the profile says so instead of guessing.
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
        <aside className="lg:sticky lg:top-24">
          <UniversityFiltersForm
            filters={filters}
            countries={options.universityCountries}
          />
        </aside>

        <section aria-labelledby="university-results" className="min-w-0">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <h2
              id="university-results"
              className="text-[13px] font-semibold tracking-wide uppercase"
            >
              {result.total === 0
                ? "No universities found"
                : `${result.total} universit${result.total === 1 ? "y" : "ies"}`}
            </h2>
            <p className="text-muted-foreground text-[11.5px]">
              Featured first, then by name. Sorted ranking is not published.
            </p>
          </div>

          {result.items.length === 0 ? (
            <EmptyResults
              title="No universities match these filters"
              description="Try a broader search, or clear the filters to see the full catalog. New records are added only after a reviewer verifies them."
              action={
                hasActiveUniversityFilters(filters) ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href="/universities">Clear filters</Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {result.items.map((university) => (
                <UniversityCard
                  key={university.id}
                  university={university}
                  signedIn={Boolean(session)}
                />
              ))}
            </div>
          )}

          <div className="mt-6">
            <Pagination
              page={result.page}
              pageCount={result.pageCount}
              hrefForPage={(page) => universitySearchHref(filters, page)}
              totalLabel={`${result.total} result${result.total === 1 ? "" : "s"}`}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
