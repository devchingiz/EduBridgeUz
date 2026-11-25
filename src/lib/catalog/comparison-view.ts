import { VERIFICATION_LABELS } from "@/lib/catalog/constants";
import { formatMoney } from "@/lib/catalog/format";
import { countryName } from "@/lib/data/countries";

/**
 * Pure view model for the comparison table. It never reads the database and
 * never invents a value: missing catalog fields stay missing, and derived
 * values are marked so the UI can say where they came from.
 */
export type ComparisonViewFact = {
  fieldKey: string;
  label: string;
  value: string | null;
  status: string;
  sourceUrl: string | null;
  sourceTitle: string | null;
  verifiedAt: string | null;
  academicYear: string | null;
  intake: string | null;
  currency: string | null;
  unit: string | null;
  note: string | null;
};

export type ComparisonViewUniversity = {
  id: string;
  slug: string;
  name: string;
  city: string;
  countryCode: string;
  websiteUrl: string | null;
  continent: string | null;
  institutionType: string | null;
  logoUrl: string | null;
  rankingDisplay: string | null;
  status: string;
  programCount: number;
  lowestAnnualTuition: {
    amountMinor: number;
    currency: string;
    sourceUrl: string | null;
  } | null;
  languages: string[];
  facts: ComparisonViewFact[];
};

export type ComparisonCell = {
  value: string | null;
  available: boolean;
  detail: string | null;
  href: string | null;
  status: string | null;
  sourceUrl: string | null;
  sourceTitle: string | null;
  verifiedAt: string | null;
  academicYear: string | null;
  intake: string | null;
  currency: string | null;
  unit: string | null;
  note: string | null;
  derived: boolean;
  /** Internal, normalised value used only to decide whether a row differs. */
  compareKey: string;
};

export type ComparisonRow = {
  id: string;
  label: string;
  cells: ComparisonCell[];
  differs: boolean;
};

export type ComparisonGroup = {
  id: string;
  label: string;
  description: string;
  rows: ComparisonRow[];
};

const HANDLED_FACT_KEYS = new Set([
  "institution_type",
  "official_website",
  "qs_ranking_2027",
]);

function normalise(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase("en");
}

function factFor(
  university: ComparisonViewUniversity,
  fieldKey: string,
): ComparisonViewFact | undefined {
  return university.facts.find((fact) => fact.fieldKey === fieldKey);
}

function factDetail(fact: ComparisonViewFact | undefined): string | null {
  if (!fact) return null;
  const parts: string[] = [];
  if (fact.academicYear) parts.push(`Academic year ${fact.academicYear}`);
  if (fact.intake) parts.push(`Intake ${fact.intake}`);
  if (fact.currency) parts.push(`Currency ${fact.currency}`);
  if (fact.unit) parts.push(`Unit ${fact.unit}`);
  return parts.length ? parts.join(" · ") : null;
}

type CreateCellInput = Partial<
  Omit<ComparisonCell, "available" | "compareKey">
> & {
  value: string | null;
};

function createCell({
  value,
  detail = null,
  href = null,
  status = null,
  sourceUrl = null,
  sourceTitle = null,
  verifiedAt = null,
  academicYear = null,
  intake = null,
  currency = null,
  unit = null,
  note = null,
  derived = false,
}: CreateCellInput): ComparisonCell {
  const available = Boolean(value && value.trim());
  return {
    value: available ? value : null,
    available,
    detail,
    href,
    status,
    sourceUrl,
    sourceTitle,
    verifiedAt,
    academicYear,
    intake,
    currency,
    unit,
    note,
    derived,
    compareKey: available
      ? [
          normalise(value),
          normalise(detail),
          normalise(currency),
          normalise(unit),
        ].join("|")
      : "—",
  };
}

function fromFact(fact: ComparisonViewFact | undefined): ComparisonCell {
  if (!fact) {
    return createCell({
      value: null,
      status: "INFORMATION_UNAVAILABLE",
      derived: false,
    });
  }

  return createCell({
    value: fact.value,
    detail: factDetail(fact),
    status: fact.status,
    sourceUrl: fact.sourceUrl,
    sourceTitle: fact.sourceTitle,
    verifiedAt: fact.verifiedAt,
    academicYear: fact.academicYear,
    intake: fact.intake,
    currency: fact.currency,
    unit: fact.unit,
    note: fact.note,
  });
}

function row(
  id: string,
  label: string,
  cells: ComparisonCell[],
): ComparisonRow {
  const differs =
    cells.length > 1 && new Set(cells.map((cell) => cell.compareKey)).size > 1;
  return { id, label, cells, differs };
}

function overviewRows(
  universities: ComparisonViewUniversity[],
): ComparisonRow[] {
  return [
    row(
      "ranking",
      "QS 2027 rank",
      universities.map((university) => {
        const fact = factFor(university, "qs_ranking_2027");
        return fromFact({
          fieldKey: "qs_ranking_2027",
          label: "QS 2027 rank",
          value: university.rankingDisplay ?? fact?.value ?? null,
          status: fact?.status ?? "INFORMATION_UNAVAILABLE",
          sourceUrl: fact?.sourceUrl ?? null,
          sourceTitle: fact?.sourceTitle ?? null,
          verifiedAt: fact?.verifiedAt ?? null,
          academicYear: fact?.academicYear ?? null,
          intake: fact?.intake ?? null,
          currency: fact?.currency ?? null,
          unit: fact?.unit ?? null,
          note: fact?.note ?? null,
        });
      }),
    ),
    row(
      "location",
      "Location",
      universities.map((university) =>
        createCell({
          value: `${university.city}, ${countryName(university.countryCode)}`,
          detail: university.continent
            ? `Continent ${university.continent}`
            : null,
          derived: false,
        }),
      ),
    ),
    row(
      "institution-type",
      "Institution type",
      universities.map((university) => {
        const fact = factFor(university, "institution_type");
        return fromFact({
          fieldKey: "institution_type",
          label: "Institution type",
          value: university.institutionType ?? fact?.value ?? null,
          status: fact?.status ?? "INFORMATION_UNAVAILABLE",
          sourceUrl: fact?.sourceUrl ?? null,
          sourceTitle: fact?.sourceTitle ?? null,
          verifiedAt: fact?.verifiedAt ?? null,
          academicYear: fact?.academicYear ?? null,
          intake: fact?.intake ?? null,
          currency: fact?.currency ?? null,
          unit: fact?.unit ?? null,
          note: fact?.note ?? null,
        });
      }),
    ),
    row(
      "official-website",
      "Official website",
      universities.map((university) => {
        const fact = factFor(university, "official_website");
        const url = university.websiteUrl ?? fact?.value ?? null;
        return createCell({
          value: url,
          href: url,
          status: fact?.status ?? null,
          sourceUrl: fact?.sourceUrl ?? null,
          sourceTitle: fact?.sourceTitle ?? null,
          verifiedAt: fact?.verifiedAt ?? null,
          note: fact?.note ?? null,
        });
      }),
    ),
    row(
      "languages",
      "Languages in visible programs",
      universities.map((university) =>
        createCell({
          value: university.languages.length
            ? university.languages.join(", ")
            : null,
          status: university.languages.length
            ? null
            : "INFORMATION_UNAVAILABLE",
          detail: "Catalog-derived from visible program samples",
          note: "Does not guarantee that every program is taught in these languages.",
          derived: true,
        }),
      ),
    ),
    row(
      "programs",
      "Program records",
      universities.map((university) =>
        createCell({
          value: String(university.programCount),
          detail: "Catalog-derived from visible program samples",
          derived: true,
        }),
      ),
    ),
    row(
      "record-status",
      "Catalog record status",
      universities.map((university) =>
        createCell({
          value:
            VERIFICATION_LABELS[
              university.status as keyof typeof VERIFICATION_LABELS
            ] ?? university.status,
          detail: "Review state of this catalog record",
        }),
      ),
    ),
  ];
}

function tuitionRows(
  universities: ComparisonViewUniversity[],
): ComparisonRow[] {
  return [
    row(
      "lowest-annual-tuition",
      "Lowest annual tuition in visible sample",
      universities.map((university) => {
        const tuition = university.lowestAnnualTuition;
        return createCell({
          value: tuition
            ? formatMoney(tuition.amountMinor, tuition.currency)
            : null,
          detail: tuition
            ? "Lowest annual amount in visible tuition facts"
            : "No annual tuition fact available",
          status: tuition ? null : "INFORMATION_UNAVAILABLE",
          sourceUrl: tuition?.sourceUrl ?? null,
          sourceTitle: tuition?.sourceUrl ? "Tuition source" : null,
          currency: tuition?.currency ?? null,
          note: "Shown in the source currency. No currency conversion is made.",
          derived: true,
        });
      }),
    ),
  ];
}

function factRows(universities: ComparisonViewUniversity[]): ComparisonRow[] {
  const keys = [
    ...new Set(
      universities.flatMap((university) =>
        university.facts.map((fact) => fact.fieldKey),
      ),
    ),
  ]
    .filter((key) => !HANDLED_FACT_KEYS.has(key))
    .sort((a, b) => {
      const labelA =
        universities
          .flatMap((university) => university.facts)
          .find((fact) => fact.fieldKey === a)?.label ?? a;
      const labelB =
        universities
          .flatMap((university) => university.facts)
          .find((fact) => fact.fieldKey === b)?.label ?? b;
      return labelA.localeCompare(labelB, "en");
    });

  return keys.map((fieldKey) => {
    const label =
      universities
        .flatMap((university) => university.facts)
        .find((fact) => fact.fieldKey === fieldKey)?.label ?? fieldKey;
    return row(
      `fact:${fieldKey}`,
      label,
      universities.map((university) => fromFact(factFor(university, fieldKey))),
    );
  });
}

export function buildComparisonGroups(
  universities: ComparisonViewUniversity[],
): ComparisonGroup[] {
  if (universities.length === 0) return [];

  const groups: ComparisonGroup[] = [
    {
      id: "overview",
      label: "Overview",
      description: "Summary fields from catalog and program records.",
      rows: overviewRows(universities),
    },
    {
      id: "tuition",
      label: "Tuition",
      description:
        "Amounts stay in their source currency; no conversion is made.",
      rows: tuitionRows(universities),
    },
  ];

  const details = factRows(universities);
  if (details.length) {
    groups.push({
      id: "field-facts",
      label: "Source-verified fields",
      description:
        "Every value keeps its verification status, citation, and context where published.",
      rows: details,
    });
  }

  return groups;
}

export function countDifferentRows(groups: ComparisonGroup[]): number {
  return groups.reduce(
    (total, group) =>
      total +
      group.rows.filter((comparisonRow) => comparisonRow.differs).length,
    0,
  );
}

export function countSourcedFields(groups: ComparisonGroup[]): number {
  return groups.reduce(
    (total, group) =>
      total +
      group.rows.reduce(
        (rowTotal, comparisonRow) =>
          rowTotal +
          comparisonRow.cells.filter((cell) => Boolean(cell.sourceUrl)).length,
        0,
      ),
    0,
  );
}
