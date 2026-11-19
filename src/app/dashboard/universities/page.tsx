import type { Metadata } from "next";
import Link from "next/link";

import { createApplicationAction } from "@/app/dashboard/workspace-actions";
import {
  CatalogBenchmarkPanel,
  catalogTuitionSummary,
} from "@/components/catalog/catalog-benchmark-panel";
import { FavoriteButton } from "@/components/catalog/favorite-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/auth/submit-button";
import { requireWorkspace } from "@/lib/auth/dal";
import { getCatalogBenchmarks } from "@/lib/catalog/benchmarks";
import { COUNTRY_OPTIONS, countryName } from "@/lib/data/countries";
import { DEGREE_LEVELS } from "@/lib/data/fields";
import {
  discoverySearchHref,
  parseUniversityDiscoveryFilters,
  type UniversityDiscoverySearchParams,
} from "@/lib/catalog/discovery-filters";
import { listUniversityDiscovery } from "@/lib/catalog/discovery-queries";
import {
  CONTINENTS,
  INSTITUTION_TYPES,
  VERIFICATION_LABELS,
} from "@/lib/catalog/constants";

export const metadata: Metadata = {
  title: "Explore Universities",
  robots: { index: false, follow: false },
};

const INTAKES = [
  ["SPRING", "Spring"],
  ["SUMMER", "Summer"],
  ["AUTUMN", "Autumn"],
  ["WINTER", "Winter"],
] as const;

const CURRENCIES = ["EUR", "USD", "GBP", "SEK", "CAD", "AUD"];

function formatMinor(amountMinor: number, currency: string): string {
  const digits =
    new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2;
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: digits,
  }).format(amountMinor / 10 ** digits);
}

function deadlineLabel(value: string): string {
  if (/^\d{2}-\d{2}$/.test(value)) {
    const [month, day] = value.split("-").map(Number);
    return new Date(Date.UTC(2020, month - 1, day)).toLocaleDateString("en", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  }
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function ExploreUniversitiesPage({
  searchParams,
}: {
  searchParams: Promise<UniversityDiscoverySearchParams>;
}) {
  const [params, session, benchmarks] = await Promise.all([
    searchParams,
    requireWorkspace(),
    getCatalogBenchmarks(),
  ]);
  const filters = parseUniversityDiscoveryFilters(params);
  const result = await listUniversityDiscovery(filters, session.user.id);
  const tuitionBenchmarkText = catalogTuitionSummary(
    benchmarks,
    filters.currency,
  );
  const tuitionBenchmarkSource =
    benchmarks.tuition.find((row) => row.currency === filters.currency) ??
    benchmarks.tuition[0];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-muted-foreground text-[12px] font-medium tracking-wide uppercase">
          Discovery
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Explore Universities</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Compare source-verified universities and keep promising options in
          your application tracker.
        </p>
      </header>

      <CatalogBenchmarkPanel
        benchmarks={benchmarks}
        variant="compact"
        currency={filters.currency}
      />

      <form
        action="/dashboard/universities"
        method="get"
        className="surface-card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <label className="space-y-1.5 text-xs font-medium sm:col-span-2">
          Search by university name
          <Input
            type="search"
            name="q"
            defaultValue={filters.q}
            maxLength={80}
            placeholder="Search universities"
          />
        </label>
        <label className="space-y-1.5 text-xs font-medium">
          Country
          <Select name="country" defaultValue={filters.country}>
            <option value="all">All countries</option>
            {COUNTRY_OPTIONS.map((country) => (
              <option key={country.value} value={country.value}>
                {country.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-1.5 text-xs font-medium">
          Continent
          <Select name="continent" defaultValue={filters.continent}>
            <option value="all">All continents</option>
            {CONTINENTS.map((continent) => (
              <option key={continent} value={continent}>
                {continent}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-1.5 text-xs font-medium">
          Institution type
          <Select name="institutionType" defaultValue={filters.institutionType}>
            <option value="all">All institution types</option>
            {INSTITUTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-1.5 text-xs font-medium">
          Degree level
          <Select name="degree" defaultValue={filters.degree}>
            <option value="all">All levels</option>
            {DEGREE_LEVELS.map((degree) => (
              <option key={degree.value} value={degree.value}>
                {degree.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-1.5 text-xs font-medium">
          Maximum annual tuition
          <Input
            type="number"
            name="maxTuition"
            min="0"
            step="any"
            defaultValue={filters.maxTuition}
            placeholder="No maximum"
          />
        </label>
        <label className="space-y-1.5 text-xs font-medium">
          Currency
          <Select name="currency" defaultValue={filters.currency}>
            {CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-1.5 text-xs font-medium">
          Scholarship
          <Select name="scholarship" defaultValue={filters.scholarship}>
            <option value="all">Any</option>
            <option value="yes">Linked scholarship available</option>
            <option value="no">No linked scholarship</option>
          </Select>
        </label>
        <label className="space-y-1.5 text-xs font-medium">
          Intake term
          <Select name="intake" defaultValue={filters.intake}>
            <option value="all">Any intake</option>
            {INTAKES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-1.5 text-xs font-medium">
          Sort by
          <Select name="sort" defaultValue={filters.sort}>
            <option value="name">Name</option>
            <option value="tuition">Lowest tuition</option>
            <option value="deadline">Nearest deadline</option>
          </Select>
        </label>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
          <Button type="submit">Apply filters</Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/universities">Clear</Link>
          </Button>
        </div>
      </form>

      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm" aria-live="polite">
          {result.total} {result.total === 1 ? "university" : "universities"}
        </p>
      </div>

      {result.items.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {result.items.map((university) => (
            <article
              key={university.id}
              className="surface-card flex h-full flex-col gap-4 p-5"
            >
              <div className="flex items-start justify-between gap-3">
                {university.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={university.logoUrl}
                    alt=""
                    width={36}
                    height={36}
                    loading="lazy"
                    className="size-9 shrink-0 rounded-md object-contain"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <h2 className="leading-5 font-semibold">
                    <Link
                      className="hover:text-primary hover:underline"
                      href={`/dashboard/universities/${university.slug}`}
                    >
                      {university.name}
                    </Link>
                  </h2>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {university.city}, {countryName(university.countryCode)}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {university.rankingDisplay
                      ? `QS 2027 · ${university.rankingDisplay}`
                      : "QS 2027 rank unavailable"}
                  </p>
                </div>
                <FavoriteButton
                  entityType="UNIVERSITY"
                  id={university.id}
                  saved={university.isFavorite}
                  signedIn
                  returnTo="/dashboard/universities"
                  compact
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant={
                    university.status === "VERIFIED"
                      ? "success"
                      : university.status === "PARTIALLY_VERIFIED"
                        ? "warning"
                        : "muted"
                  }
                >
                  {VERIFICATION_LABELS[
                    university.status as keyof typeof VERIFICATION_LABELS
                  ] ?? "Under review"}
                </Badge>
                {university.continent ? (
                  <Badge variant="muted">{university.continent}</Badge>
                ) : null}
                {university.institutionType ? (
                  <Badge variant="outline">{university.institutionType}</Badge>
                ) : null}
                {university.scholarshipAvailable ? (
                  <Badge variant="brand">Linked scholarship</Badge>
                ) : null}
                {university.websiteUrl ? (
                  <a
                    className="text-primary inline-flex items-center gap-1 text-xs underline underline-offset-2"
                    href={university.websiteUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Official site ↗
                  </a>
                ) : (
                  <span className="text-muted-foreground text-xs italic">
                    Official site unavailable
                  </span>
                )}
              </div>
              <dl className="grid gap-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Tuition per year</dt>
                  <dd className="text-right font-medium">
                    {university.tuitionAmountMinor === null ? (
                      <span className="block">
                        Not reported for this university
                        <span className="text-muted-foreground mt-0.5 block text-[11px] font-normal">
                          Catalog benchmark: {tuitionBenchmarkText} · derived,
                          not this university
                        </span>
                      </span>
                    ) : (
                      <>
                        <span>
                          {formatMinor(
                            university.tuitionAmountMinor,
                            university.tuitionCurrency,
                          )}
                        </span>
                        {university.tuitionApplicantGroup ? (
                          <span className="text-muted-foreground block text-xs font-normal">
                            {university.tuitionApplicantGroup}
                          </span>
                        ) : null}
                      </>
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Nearest deadline</dt>
                  <dd className="text-right">
                    {university.nearestDeadline ? (
                      <span className="block font-medium">
                        {deadlineLabel(university.nearestDeadline.label)}
                      </span>
                    ) : (
                      <span className="block">
                        <span className="font-medium">
                          Not reported for this university
                        </span>
                        <span className="text-muted-foreground mt-0.5 block text-[11px] font-normal">
                          No catalog average; deadlines are cycle-specific
                        </span>
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
              {university.tuitionAmountMinor === null &&
              tuitionBenchmarkSource?.sourceUrl ? (
                <a
                  className="text-primary text-xs underline underline-offset-2"
                  href={tuitionBenchmarkSource.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Tuition benchmark source
                </a>
              ) : null}
              {university.nearestDeadline ? (
                <a
                  className="text-primary text-xs underline underline-offset-2"
                  href={university.nearestDeadline.source.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Deadline source
                </a>
              ) : null}
              {university.lastVerifiedAt ? (
                <p className="text-muted-foreground text-xs">
                  Last verified {university.lastVerifiedAt}
                </p>
              ) : null}
              <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                <Link
                  href={`/dashboard/universities/${university.slug}`}
                  className="text-primary text-sm font-medium hover:underline"
                >
                  View details
                </Link>
                {university.isTracked ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href="/dashboard/applications">In tracker</Link>
                  </Button>
                ) : (
                  <form action={createApplicationAction}>
                    <input
                      type="hidden"
                      name="universityId"
                      value={university.id}
                    />
                    <input type="hidden" name="status" value="INTERESTED" />
                    <input type="hidden" name="notes" value="" />
                    <input type="hidden" name="deadline" value="" />
                    <SubmitButton size="sm" pendingLabel="Adding…">
                      Add to tracker
                    </SubmitButton>
                  </form>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="surface-card px-5 py-12 text-center">
          <h2 className="font-semibold">No universities match these filters</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Try broadening your search or clearing one or more filters.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/dashboard/universities">Clear filters</Link>
          </Button>
        </div>
      )}

      {result.pageCount > 1 ? (
        <nav
          aria-label="University result pages"
          className="flex items-center justify-between gap-3"
        >
          <Button
            asChild
            variant="outline"
            size="sm"
            aria-disabled={result.page <= 1}
          >
            <Link
              href={discoverySearchHref(filters, Math.max(1, result.page - 1))}
              tabIndex={result.page <= 1 ? -1 : undefined}
            >
              Previous
            </Link>
          </Button>
          <p className="text-muted-foreground text-sm">
            Page {result.page} of {result.pageCount}
          </p>
          <Button
            asChild
            variant="outline"
            size="sm"
            aria-disabled={result.page >= result.pageCount}
          >
            <Link
              href={discoverySearchHref(
                filters,
                Math.min(result.pageCount, result.page + 1),
              )}
              tabIndex={result.page >= result.pageCount ? -1 : undefined}
            >
              Next
            </Link>
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
