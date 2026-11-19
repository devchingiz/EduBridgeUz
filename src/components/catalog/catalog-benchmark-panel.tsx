import { Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FUNDING_LABELS, type FundingTypeValue } from "@/lib/catalog/constants";
import { formatCheckedOn, formatMoney } from "@/lib/catalog/format";
import type {
  BenchmarkSource,
  CatalogBenchmarks,
} from "@/lib/catalog/benchmarks";
import { cn } from "@/lib/utils";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function money(amountMinor: number, currency: string): string {
  return formatMoney(amountMinor, currency);
}

function tuitionText(
  benchmark: CatalogBenchmarks["tuition"][number] | undefined,
): string {
  if (!benchmark) return "No catalog tuition average available";
  return `${money(benchmark.averageMinor, benchmark.currency)} ${benchmark.period}`;
}

/**
 * Picks a matching currency first, then falls back to annual records. Every
 * caller must label the result as derived context, never as a university quote.
 */
export function catalogTuitionSummary(
  benchmarks: CatalogBenchmarks,
  currency?: string,
): string {
  const normalized = currency?.trim().toUpperCase();
  const matching = normalized
    ? benchmarks.tuition.filter((row) => row.currency === normalized)
    : [];
  const selected =
    (normalized
      ? matching[0]
      : (benchmarks.annualTuition[0] ?? benchmarks.tuition[0])) ??
    benchmarks.annualTuition[0] ??
    benchmarks.tuition[0];

  if (!selected) return "No catalog tuition average available";
  const base = tuitionText(selected);
  if (normalized && selected.currency !== normalized) {
    return `${base} (no ${normalized} average in the catalog)`;
  }
  return `${base} · ${selected.sampleSize} sourced record${selected.sampleSize === 1 ? "" : "s"}`;
}

function SourceLine({
  source,
}: {
  source: BenchmarkSource | null | undefined;
}) {
  if (!source?.url) {
    return (
      <p className="text-muted-foreground text-[11px]">
        Source evidence unavailable
      </p>
    );
  }

  return (
    <p className="text-muted-foreground text-[11px] leading-4">
      <a
        href={source.url}
        target="_blank"
        rel="noreferrer noopener"
        className="text-foreground underline underline-offset-2"
      >
        {source.title ?? "Catalog source"}
      </a>
      {source.verifiedAt ? ` · ${formatCheckedOn(source.verifiedAt)}` : ""}
    </p>
  );
}

function BenchmarkLabel() {
  return (
    <Badge variant="warning" className="whitespace-normal">
      <Info aria-hidden="true" />
      Derived estimate · not university-specific
    </Badge>
  );
}

function Metric({
  label,
  value,
  detail,
  source,
}: {
  label: string;
  value: string;
  detail?: string;
  source?: BenchmarkSource | null;
}) {
  return (
    <div className="bg-card rounded-xl border p-4">
      <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        {label}
      </p>
      <p className="mt-1.5 text-base font-semibold">{value}</p>
      {detail ? (
        <p className="text-muted-foreground mt-1 text-xs leading-5">{detail}</p>
      ) : null}
      {source ? (
        <div className="mt-2">
          <SourceLine source={source} />
        </div>
      ) : null}
    </div>
  );
}

export function CatalogBenchmarkPanel({
  benchmarks,
  variant = "full",
  currency,
  className,
}: {
  benchmarks: CatalogBenchmarks;
  variant?: "compact" | "full";
  currency?: string;
  className?: string;
}) {
  const tuitionRows = currency
    ? benchmarks.tuition.filter((row) => row.currency === currency)
    : benchmarks.tuition;
  const shownTuition = tuitionRows.length ? tuitionRows : benchmarks.tuition;
  const topLanguage = benchmarks.languages[0];
  const topIntake = benchmarks.intakeMonths[0];
  const topFunding = benchmarks.fundingMix[0];
  const compact = variant === "compact";

  return (
    <Card
      className={cn(
        "border-primary/20 bg-accent/10 shadow-none",
        compact ? "p-4" : "",
        className,
      )}
    >
      <CardHeader className={compact ? "p-0 pb-3" : undefined}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className={compact ? "text-sm" : "text-base"}>
            Catalog benchmarks
          </CardTitle>
          <BenchmarkLabel />
        </div>
        <CardDescription className="text-[12px] leading-5">
          Calculated from source-bearing records already in EduBridge. Use these
          figures only as planning context; they are not a quote or a guarantee
          for any university.
        </CardDescription>
      </CardHeader>
      <CardContent className={compact ? "space-y-3 p-0" : "space-y-4"}>
        {compact ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-muted-foreground text-[11px] font-medium uppercase">
                Tuition context
              </p>
              <p className="mt-1 text-sm font-medium">
                {catalogTuitionSummary(benchmarks, currency)}
              </p>
              {benchmarks.tuition[0] ? (
                <SourceLine
                  source={{
                    url: benchmarks.tuition[0].sourceUrl,
                    title: benchmarks.tuition[0].sourceTitle,
                    verifiedAt: benchmarks.tuition[0].verifiedAt,
                  }}
                />
              ) : null}
            </div>
            <div>
              <p className="text-muted-foreground text-[11px] font-medium uppercase">
                Scholarship mix
              </p>
              <p className="mt-1 text-sm font-medium">
                {topFunding
                  ? `${FUNDING_LABELS[topFunding.value as FundingTypeValue] ?? topFunding.value}: ${topFunding.count}/${benchmarks.scholarshipRecords} sourced records`
                  : "No sourced scholarship records"}
              </p>
              <p className="text-muted-foreground mt-1 text-[11px]">
                No award amounts are stored.
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-[11px] font-medium uppercase">
                Program shape
              </p>
              <p className="mt-1 text-sm font-medium">
                {topLanguage
                  ? `${topLanguage.value}: ${topLanguage.count}/${benchmarks.languageRecords} recorded programs`
                  : "Language not recorded"}
              </p>
              <p className="text-muted-foreground mt-1 text-[11px]">
                {benchmarks.averageDurationMonths
                  ? `Average duration: ${benchmarks.averageDurationMonths} months (${benchmarks.durationRecords} records)`
                  : "Average duration unavailable"}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="bg-card rounded-xl border p-4">
                <p className="text-[13px] font-semibold">Tuition averages</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Arithmetic mean of published amounts, grouped by currency and
                  stated period. No currency conversion is applied.
                </p>
                <div className="mt-3 space-y-3">
                  {shownTuition.length ? (
                    shownTuition.map((row) => (
                      <div key={`${row.currency}-${row.period}`}>
                        <p className="text-sm font-medium">
                          {tuitionText(row)} · {row.sampleSize} sourced record
                          {row.sampleSize === 1 ? "" : "s"}
                        </p>
                        <SourceLine
                          source={{
                            url: row.sourceUrl,
                            title: row.sourceTitle,
                            verifiedAt: row.verifiedAt,
                          }}
                        />
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      No sourced tuition amounts are available.
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-card rounded-xl border p-4">
                <p className="text-[13px] font-semibold">
                  Scholarship funding mix
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Counts of sourced scholarship records by stated funding type.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {benchmarks.fundingMix.length ? (
                    benchmarks.fundingMix.map((row) => (
                      <span
                        key={row.value}
                        className="rounded-full border px-2.5 py-1 text-xs"
                      >
                        {FUNDING_LABELS[row.value as FundingTypeValue] ??
                          row.value}{" "}
                        · {row.count}
                      </span>
                    ))
                  ) : (
                    <span className="text-muted-foreground text-sm">
                      No sourced scholarship records.
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground mt-3 text-xs leading-5">
                  The catalog does not store scholarship award amounts, so no
                  numerical scholarship average is calculated.
                </p>
                <SourceLine source={benchmarks.scholarshipSource} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Metric
                label="Recorded language"
                value={
                  topLanguage
                    ? `${topLanguage.value} · ${topLanguage.count}/${benchmarks.languageRecords}`
                    : "Information unavailable"
                }
                detail={`${benchmarks.programRecords} sourced program records were checked.`}
                source={benchmarks.programSource}
              />
              <Metric
                label="Duration and intake"
                value={
                  benchmarks.averageDurationMonths
                    ? `${benchmarks.averageDurationMonths} months average`
                    : "Duration unavailable"
                }
                detail={
                  topIntake
                    ? `${MONTH_NAMES[topIntake.month - 1]}: ${topIntake.count} program start records · ${benchmarks.durationRecords} duration records`
                    : `No numeric intake months recorded · ${benchmarks.durationRecords} duration records`
                }
                source={benchmarks.programSource}
              />
            </div>
          </>
        )}
        <p className="text-muted-foreground border-t pt-3 text-[11px] leading-5">
          Method: averages and counts use only visible records with a cited
          source; missing values are excluded. These derived figures do not
          replace an institution&apos;s published offer or deadline.
        </p>
      </CardContent>
    </Card>
  );
}

export type BenchmarkStripKind =
  "tuition" | "scholarship" | "program" | "deadline";

/** Small, clearly-labelled context line for a specific detail section. */
export function BenchmarkStrip({
  benchmarks,
  kind,
}: {
  benchmarks: CatalogBenchmarks;
  kind: BenchmarkStripKind;
}) {
  const text = (() => {
    if (kind === "tuition") {
      return catalogTuitionSummary(benchmarks);
    }
    if (kind === "scholarship") {
      const top = benchmarks.fundingMix[0];
      return top
        ? `${FUNDING_LABELS[top.value as FundingTypeValue] ?? top.value} is the most common recorded type (${top.count}/${benchmarks.scholarshipRecords}); no award amounts are stored.`
        : "No sourced scholarship records are available for an average.";
    }
    if (kind === "program") {
      const language = benchmarks.languages[0];
      const duration = benchmarks.averageDurationMonths;
      return (
        [
          language
            ? `${language.value} in ${language.count}/${benchmarks.languageRecords} recorded programs`
            : null,
          duration
            ? `${duration}-month average duration (${benchmarks.durationRecords} records)`
            : null,
        ]
          .filter(Boolean)
          .join(" · ") || "No program language or duration benchmark available."
      );
    }
    const month = benchmarks.intakeMonths[0];
    return month
      ? `${MONTH_NAMES[month.month - 1]} appears in ${month.count} program start records. Deadlines are not averaged because they are cycle-specific.`
      : "No numeric intake months recorded; deadlines are not averaged.";
  })();

  return (
    <p className="bg-accent/40 text-muted-foreground mt-3 rounded-lg border px-3 py-2 text-[12px] leading-5">
      <span className="text-foreground font-medium">Catalog benchmark:</span>{" "}
      {text} <span className="font-medium">Not university-specific.</span>
    </p>
  );
}
