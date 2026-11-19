"use client";

import {
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  GraduationCap,
  Info,
  MapPin,
  Search,
  SearchX,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/marketing/section-heading";
import {
  ALL_FILTER,
  emptyUniversityFilters,
  filterSampleUniversities,
  hasActiveUniversityFilters,
  type UniversityFilterState,
} from "@/lib/demo/university-filter";
import {
  sampleCountries,
  sampleUniversities,
  type UniversityTone,
} from "@/lib/demo/sample-universities";
import { cn } from "@/lib/utils";

const toneClasses: Record<UniversityTone, string> = {
  indigo:
    "bg-indigo-50 text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-300",
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300",
  sky: "bg-sky-50 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300",
  emerald:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300",
  violet:
    "bg-violet-50 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300",
  cyan: "bg-cyan-50 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-300",
  rose: "bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300",
};

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="border-input bg-card focus-within:border-ring focus-within:ring-ring/15 relative flex h-12 flex-col justify-center rounded-lg border px-3 shadow-[0_1px_2px_rgb(15_23_42/0.03)] transition-colors focus-within:ring-3">
      <span className="text-muted-foreground text-[9.5px] font-medium tracking-[0.12em] uppercase">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="text-foreground mt-0.5 w-full cursor-pointer appearance-none bg-transparent pr-6 text-[13px] font-medium outline-none"
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="text-muted-foreground pointer-events-none absolute right-2.5 bottom-2.5 size-3.5"
      />
    </label>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-7 shrink-0 items-center rounded-full border px-2.5 text-[11px] font-medium transition-colors",
        active
          ? "border-primary/30 bg-accent text-accent-foreground"
          : "border-border bg-card text-muted-foreground hover:border-primary/25 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function UniversitySearch() {
  const [filters, setFilters] = useState<UniversityFilterState>(
    emptyUniversityFilters,
  );

  const results = useMemo(
    () => filterSampleUniversities(sampleUniversities, filters),
    [filters],
  );

  const filtersActive = hasActiveUniversityFilters(filters);

  function updateFilter<K extends keyof UniversityFilterState>(
    key: K,
    value: UniversityFilterState[K],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    setFilters(emptyUniversityFilters);
  }

  return (
    <section
      id="universities"
      aria-labelledby="universities-heading"
      className="section-shell border-border/60 scroll-mt-20 border-t"
    >
      <div className="site-container">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            eyebrow="University discovery"
            title={
              <span id="universities-heading">
                Find a university that fits the life you want.
              </span>
            }
            description="Search by destination, degree, and field. Every live record will show its official source, verification date, and review status — so you can check before you act."
          />
          <a
            href="#verification"
            className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1.5 text-[13px] font-medium transition-colors"
          >
            How we verify data
            <ArrowUpRight className="size-3.5" />
          </a>
        </div>

        <div className="border-border bg-card mt-9 overflow-hidden rounded-2xl border shadow-[0_1px_2px_rgb(15_23_42/0.03)]">
          <div className="border-border bg-muted/40 border-b p-4 sm:p-5">
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-[1.65fr_1fr_1fr_1fr]">
              <label className="border-input bg-card focus-within:border-ring focus-within:ring-ring/15 relative flex h-12 items-center rounded-lg border shadow-[0_1px_2px_rgb(15_23_42/0.03)] transition-colors focus-within:ring-3">
                <span className="sr-only">Search universities</span>
                <Search
                  aria-hidden="true"
                  className="text-muted-foreground pointer-events-none absolute left-3 size-4"
                />
                <input
                  type="search"
                  value={filters.query}
                  onChange={(event) =>
                    updateFilter("query", event.target.value)
                  }
                  placeholder="University, city, or field"
                  className="text-foreground placeholder:text-muted-foreground h-full w-full bg-transparent pr-9 pl-9 text-sm outline-none"
                />
                {filters.query ? (
                  <button
                    type="button"
                    onClick={() => updateFilter("query", "")}
                    className="text-muted-foreground hover:bg-muted hover:text-foreground absolute right-2 inline-flex size-6 items-center justify-center rounded-md"
                    aria-label="Clear search"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </label>

              <SelectField
                label="Destination"
                value={filters.country}
                onChange={(value) => updateFilter("country", value)}
              >
                <option value={ALL_FILTER}>All countries</option>
                {sampleCountries.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </SelectField>

              <SelectField
                label="Degree"
                value={filters.degree}
                onChange={(value) => updateFilter("degree", value)}
              >
                <option value={ALL_FILTER}>All degrees</option>
                <option value="Bachelor">Bachelor&apos;s</option>
                <option value="Master">Master&apos;s</option>
                <option value="PhD">PhD</option>
              </SelectField>

              <SelectField
                label="Study field"
                value={filters.field}
                onChange={(value) => updateFilter("field", value)}
              >
                <option value={ALL_FILTER}>All fields</option>
                <option value="Computer Science">Computer Science</option>
                <option value="Engineering">Engineering</option>
                <option value="Business">Business</option>
                <option value="Economics">Economics</option>
                <option value="Medicine">Medicine</option>
                <option value="Social Sciences">Social Sciences</option>
              </SelectField>
            </div>

            <div className="mt-3 flex scrollbar-none items-center gap-2 overflow-x-auto pb-0.5">
              <span className="text-muted-foreground shrink-0 text-[11px]">
                Try:
              </span>
              <FilterChip
                active={filters.field === "Computer Science"}
                onClick={() =>
                  updateFilter(
                    "field",
                    filters.field === "Computer Science"
                      ? ALL_FILTER
                      : "Computer Science",
                  )
                }
              >
                Computer Science
              </FilterChip>
              <FilterChip
                active={filters.degree === "Master"}
                onClick={() =>
                  updateFilter(
                    "degree",
                    filters.degree === "Master" ? ALL_FILTER : "Master",
                  )
                }
              >
                Master&apos;s
              </FilterChip>
              <FilterChip
                active={filters.country === "South Korea"}
                onClick={() =>
                  updateFilter(
                    "country",
                    filters.country === "South Korea"
                      ? ALL_FILTER
                      : "South Korea",
                  )
                }
              >
                South Korea
              </FilterChip>
              {filtersActive ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-muted-foreground hover:text-foreground ml-auto inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-medium transition-colors"
                >
                  Clear all
                  <X className="size-3" />
                </button>
              ) : null}
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p aria-live="polite" className="text-muted-foreground text-xs">
                Showing{" "}
                <span className="text-foreground font-semibold">
                  {results.length}
                </span>{" "}
                of {sampleUniversities.length} sample profiles
                {filtersActive ? " matching your filters" : ""}
              </p>
              <Badge variant="outline" className="gap-1.5">
                <Info className="size-3" />
                Preview data
              </Badge>
            </div>

            {results.length > 0 ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {results.map((university) => (
                  <article
                    key={university.id}
                    className="group border-border bg-card hover:border-primary/25 flex flex-col rounded-xl border p-4 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_-20px_rgb(49_46_129/0.45)]"
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-lg text-[10.5px] font-semibold tracking-tight",
                          toneClasses[university.tone],
                        )}
                        aria-hidden="true"
                      >
                        {university.initials}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3
                          className="truncate text-[13px] font-semibold tracking-[-0.01em]"
                          title={university.name}
                        >
                          {university.name}
                        </h3>
                        <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-[11px]">
                          <MapPin className="size-3 shrink-0" />
                          <span className="truncate">
                            {university.city}, {university.country}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="text-muted-foreground mt-3 flex items-center gap-1.5 text-[11px]">
                      <GraduationCap className="size-3.5 shrink-0" />
                      {university.degrees.join(" · ")}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1">
                      {university.fields.slice(0, 3).map((field) => (
                        <span
                          key={field}
                          className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                        >
                          {field}
                        </span>
                      ))}
                      {university.fields.length > 3 ? (
                        <span className="text-muted-foreground rounded-md px-1 py-0.5 text-[10px]">
                          +{university.fields.length - 3}
                        </span>
                      ) : null}
                    </div>

                    <div className="border-border/70 mt-auto flex items-center justify-between gap-2 border-t pt-3">
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className="h-5 px-1.5 text-[9.5px] font-normal"
                        >
                          {university.type}
                        </Badge>
                        <span className="text-muted-foreground inline-flex items-center gap-1 text-[9.5px]">
                          <BookOpen className="size-2.5" />
                          Sample
                        </span>
                      </div>
                      <a
                        href={university.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80 inline-flex items-center gap-0.5 text-[10.5px] font-medium transition-colors"
                      >
                        Visit
                        <ArrowUpRight className="size-3" />
                        <span className="sr-only">
                          {university.name} official website (opens in a new
                          tab)
                        </span>
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="border-border bg-muted/25 mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center">
                <div className="bg-muted flex size-11 items-center justify-center rounded-full">
                  <SearchX className="text-muted-foreground size-5" />
                </div>
                <h3 className="mt-3 text-sm font-semibold">
                  No sample profiles match those filters
                </h3>
                <p className="text-muted-foreground mt-1 max-w-sm text-xs leading-5">
                  Try a different country, degree, or study field. This preview
                  only contains eight profiles.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={resetFilters}
                >
                  Reset filters
                </Button>
              </div>
            )}

            <div className="border-border/70 bg-muted/35 mt-4 flex items-start gap-2.5 rounded-xl border px-3.5 py-3">
              <Info
                aria-hidden="true"
                className="text-primary mt-0.5 size-3.5 shrink-0"
              />
              <p className="text-muted-foreground text-[11px] leading-5">
                <span className="text-foreground font-medium">
                  Sample profiles only.
                </span>{" "}
                These eight records intentionally omit tuition, rankings,
                deadlines, and admission requirements. Those facts will only
                appear once they are sourced from the official institution and
                carry a verification date. Official website links are provided
                for independent checking.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
