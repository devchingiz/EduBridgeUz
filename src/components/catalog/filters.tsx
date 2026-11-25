import { Search, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  ALL_FILTER,
  hasActiveScholarshipFilters,
  hasActiveUniversityFilters,
  type ScholarshipFilters,
  type UniversityFilters,
} from "@/lib/catalog/filters";
import {
  CONTINENTS,
  FUNDING_LABELS,
  FUNDING_TYPES,
  INSTITUTION_TYPES,
} from "@/lib/catalog/constants";
import { COUNTRY_OPTIONS, countryName } from "@/lib/data/countries";
import { DEGREE_LEVELS, STUDY_FIELDS } from "@/lib/data/fields";

/**
 * Search filters are a plain GET form so results work without JavaScript and
 * every filtered view has a shareable, indexable URL.
 */

const fieldOptions = [
  { value: ALL_FILTER, label: "All fields" },
  ...STUDY_FIELDS.map((field) => ({ value: field, label: field })),
];

const degreeOptions = [
  { value: ALL_FILTER, label: "All degree levels" },
  ...DEGREE_LEVELS.map((degree) => ({
    value: degree.value,
    label: degree.label,
  })),
];

function FilterShell({
  action,
  children,
  active,
  clearHref,
  label,
}: {
  action: string;
  children: React.ReactNode;
  active: boolean;
  clearHref: string;
  label: string;
}) {
  return (
    <form
      action={action}
      method="get"
      role="search"
      aria-label={label}
      className="surface-card space-y-4 p-4 sm:p-5"
    >
      <div className="flex items-center gap-2">
        <SlidersHorizontal
          aria-hidden="true"
          className="text-muted-foreground size-4"
        />
        <h2 className="text-[13px] font-semibold">Filters</h2>
        {active ? (
          <Link
            href={clearHref}
            className="text-muted-foreground hover:text-foreground ml-auto inline-flex items-center gap-1 text-[12px]"
          >
            <X aria-hidden="true" className="size-3.5" />
            Clear all
          </Link>
        ) : null}
      </div>
      {children}
    </form>
  );
}

function SearchInput({ defaultValue }: { defaultValue: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="catalog-q">Search</Label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <Input
          id="catalog-q"
          name="q"
          type="search"
          defaultValue={defaultValue}
          placeholder="University, city, or program"
          className="pl-9"
        />
      </div>
    </div>
  );
}

function FilterSelect({
  id,
  name,
  label,
  value,
  options,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select id={id} name={name} defaultValue={value}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function UniversityFiltersForm({
  filters,
  countries,
}: {
  filters: UniversityFilters;
  countries: string[];
}) {
  return (
    <FilterShell
      action="/universities"
      active={hasActiveUniversityFilters(filters)}
      clearHref="/universities"
      label="Filter universities"
    >
      <SearchInput defaultValue={filters.q} />
      <FilterSelect
        id="university-country"
        name="country"
        label="Country"
        value={filters.country}
        options={[
          { value: ALL_FILTER, label: "All countries" },
          ...countries.map((code) => ({
            value: code,
            label: countryName(code),
          })),
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <FilterSelect
          id="university-degree"
          name="degree"
          label="Degree"
          value={filters.degree}
          options={degreeOptions}
        />
        <FilterSelect
          id="university-field"
          name="field"
          label="Field"
          value={filters.field}
          options={fieldOptions}
        />
        <FilterSelect
          id="university-continent"
          name="continent"
          label="Continent"
          value={filters.continent}
          options={[
            { value: ALL_FILTER, label: "All continents" },
            ...CONTINENTS.map((value) => ({ value, label: value })),
          ]}
        />
        <FilterSelect
          id="university-institution-type"
          name="institution_type"
          label="Institution type"
          value={filters.institutionType}
          options={[
            { value: ALL_FILTER, label: "All institution types" },
            ...INSTITUTION_TYPES.map((value) => ({ value, label: value })),
          ]}
        />
      </div>
      <Button type="submit" size="sm" className="w-full">
        Show results
      </Button>
    </FilterShell>
  );
}

export function ScholarshipFiltersForm({
  filters,
  hostCountries,
  action = "/scholarships",
  clearHref = "/scholarships",
}: {
  filters: ScholarshipFilters;
  hostCountries: string[];
  action?: string;
  clearHref?: string;
}) {
  return (
    <FilterShell
      action={action}
      active={hasActiveScholarshipFilters(filters)}
      clearHref={clearHref}
      label="Filter scholarships"
    >
      <SearchInput defaultValue={filters.q} />
      <div className="grid gap-3 sm:grid-cols-2">
        <FilterSelect
          id="scholarship-host-country"
          name="host_country"
          label="Host country"
          value={filters.hostCountry}
          options={[
            { value: ALL_FILTER, label: "All host countries" },
            ...hostCountries.map((code) => ({
              value: code,
              label: countryName(code),
            })),
          ]}
        />
        <FilterSelect
          id="scholarship-funding"
          name="funding"
          label="Funding"
          value={filters.funding}
          options={[
            { value: ALL_FILTER, label: "All funding types" },
            ...FUNDING_TYPES.map((type) => ({
              value: type,
              label: FUNDING_LABELS[type],
            })),
          ]}
        />
        <FilterSelect
          id="scholarship-degree"
          name="degree"
          label="Degree"
          value={filters.degree}
          options={degreeOptions}
        />
        <FilterSelect
          id="scholarship-field"
          name="field"
          label="Field"
          value={filters.field}
          options={fieldOptions}
        />
      </div>
      <FilterSelect
        id="scholarship-nationality"
        name="nationality"
        label="Your nationality"
        value={filters.nationality}
        options={[
          { value: ALL_FILTER, label: "Any nationality" },
          ...COUNTRY_OPTIONS,
        ]}
      />
      <p className="text-muted-foreground text-[11.5px] leading-5">
        Nationality filtering only shows scholarships that state an open or
        listed eligibility. It never guarantees that you qualify.
      </p>
      <Button type="submit" size="sm" className="w-full">
        Show scholarships
      </Button>
    </FilterShell>
  );
}
