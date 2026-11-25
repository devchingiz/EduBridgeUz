import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import {
  createApplicationAction,
  setApplicationDeadlineAction,
} from "@/app/dashboard/workspace-actions";
import {
  BenchmarkStrip,
  CatalogBenchmarkPanel,
  hasBenchmarkForKind,
  hasCatalogBenchmarkData,
} from "@/components/catalog/catalog-benchmark-panel";
import { ComparisonButton } from "@/components/catalog/comparison-button";
import { FavoriteButton } from "@/components/catalog/favorite-button";
import { FieldFactPanel } from "@/components/catalog/verification";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/auth/submit-button";
import { requireWorkspace } from "@/lib/auth/dal";
import { getCatalogBenchmarks } from "@/lib/catalog/benchmarks";
import { countryName } from "@/lib/data/countries";
import { degreeLabel } from "@/lib/data/fields";
import { getUniversityDiscoveryDetail } from "@/lib/catalog/discovery-queries";
import { getComparisonIds } from "@/lib/catalog/comparison";
import { VERIFICATION_LABELS } from "@/lib/catalog/constants";
import { availableText, filterAvailableFacts } from "@/lib/catalog/fact-groups";
import { plainText } from "@/lib/catalog/format";
import { NotebookPen } from "lucide-react";

export const metadata: Metadata = {
  title: "University details",
  robots: { index: false, follow: false },
};

const REQUIREMENT_LABELS: Record<string, string> = {
  ACADEMIC: "Academic",
  ENGLISH_LANGUAGE: "Language test",
  DOCUMENT: "Document",
  PORTFOLIO: "Portfolio",
  WORK_EXPERIENCE: "Work experience",
  OTHER: "Other",
};

const COST_LABELS: Record<string, string> = {
  LIVING_COST: "Living cost",
  APPLICATION_FEE: "Application fee",
};

function money(amountMinor: number, currency: string): string {
  const digits =
    new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2;
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(
    amountMinor / 10 ** digits,
  );
}

function SourceLink({
  source,
}: {
  source: {
    url: string | null;
    title: string | null;
    verifiedAt: string | null;
  } | null;
}) {
  if (!source?.url) return null;

  return (
    <span className="text-muted-foreground text-xs">
      <a
        href={source.url}
        target="_blank"
        rel="noreferrer"
        className="text-primary underline underline-offset-2"
      >
        Source: {source.title ?? "Source"}
      </a>
      {source.verifiedAt ? ` · Verified ${source.verifiedAt}` : ""}
    </span>
  );
}

export default async function UniversityDiscoveryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ deadline?: string }>;
}) {
  const [{ slug }, query, session] = await Promise.all([
    params,
    searchParams,
    requireWorkspace(),
  ]);
  const [university, comparisonIds, benchmarks] = await Promise.all([
    getUniversityDiscoveryDetail(slug, session.user.id),
    getComparisonIds(session.user.id),
    getCatalogBenchmarks(),
  ]);
  if (!university) notFound();
  const savedInComparison = comparisonIds.includes(university.id);

  const location = [university.city, countryName(university.countryCode)]
    .filter(Boolean)
    .join(", ");
  const websiteUrl = university.websiteUrl?.trim() || null;
  const ranking = university.rankingDisplay?.trim() || null;
  const description = plainText(university.description);
  const hasPrimarySource = Boolean(university.primarySource?.url);
  const availableFacts = filterAvailableFacts(
    university.fieldFacts.map((fact) => ({
      label: fact.label,
      value: fact.value,
      status: fact.status,
      sourceUrl: fact.sourceUrl,
      sourceTitle: fact.sourceTitle,
      verifiedAt: fact.verifiedAt,
      academicYear: fact.academicYear,
      intake: fact.intake,
      currency: fact.currency,
      unit: fact.unit,
      note: fact.note,
    })),
  );

  const programsWithCosts = university.programs.filter(
    (program) => program.tuition.length > 0 || program.costs.length > 0,
  );
  const scholarshipEntries = university.programs.flatMap((program) =>
    program.scholarships.map((scholarship) => ({
      program,
      scholarship,
      summary: availableText(scholarship.summary),
    })),
  );
  const programsWithRequirements = university.programs
    .map((program) => ({
      program,
      requirements: program.requirements.flatMap((requirement) => {
        const summary = availableText(requirement.summary);
        return summary
          ? [
              {
                kind: requirement.kind,
                summary,
                source: requirement.source,
              },
            ]
          : [];
      }),
    }))
    .filter((entry) => entry.requirements.length > 0);
  const deadlinePrograms = university.programs
    .map((program) => {
      const intakes = program.intakes.flatMap((intake) => {
        const term = availableText(intake.term);
        const note = availableText(intake.note);
        return term || note ? [{ term, note, source: intake.source }] : [];
      });
      return {
        program,
        intakes,
        deadlines: program.deadlines.filter(
          (deadline) => deadline.deadlineOn || deadline.deadlineMonthDay,
        ),
        startNote: availableText(program.startNote),
      };
    })
    .filter(
      (entry) =>
        entry.intakes.length > 0 ||
        entry.deadlines.length > 0 ||
        Boolean(entry.startNote),
    );
  const sourceRows = [
    ...(hasPrimarySource
      ? [{ label: null, source: university.primarySource }]
      : []),
    ...university.programs
      .filter((program) => Boolean(program.source?.url))
      .map((program) => ({ label: program.name, source: program.source })),
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {query.deadline === "added" ? (
        <Alert variant="success">
          The deadline was added to your application calendar.
        </Alert>
      ) : null}
      <header className="surface-card space-y-4 p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="text-muted-foreground text-[12px] font-medium tracking-wide uppercase">
              University profile
            </p>
            <div className="flex items-start gap-3">
              {university.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={university.logoUrl}
                  alt=""
                  width={56}
                  height={56}
                  className="size-14 shrink-0 rounded-lg object-contain"
                />
              ) : null}
              <div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  {university.name}
                </h1>
                {location ? (
                  <p className="text-muted-foreground text-sm">{location}</p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {ranking ? (
                <Badge variant="brand">
                  {university.rankingOrganization ?? "QS"} · {ranking}
                </Badge>
              ) : null}
              {university.continent ? (
                <Badge variant="muted">{university.continent}</Badge>
              ) : null}
              {availableText(university.institutionType) ? (
                <Badge variant="outline">
                  {availableText(university.institutionType)}
                </Badge>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  university.verificationStatus === "VERIFIED"
                    ? "success"
                    : university.verificationStatus === "PARTIALLY_VERIFIED"
                      ? "warning"
                      : "muted"
                }
              >
                {VERIFICATION_LABELS[
                  university.verificationStatus as keyof typeof VERIFICATION_LABELS
                ] ?? "Under review"}
              </Badge>
              {university.lastVerifiedAt ? (
                <span className="text-muted-foreground text-xs">
                  Last verified {university.lastVerifiedAt}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FavoriteButton
              entityType="UNIVERSITY"
              id={university.id}
              saved={university.isFavorite}
              signedIn
              returnTo={`/dashboard/universities/${university.slug}`}
            />
            <ComparisonButton
              universityId={university.id}
              saved={savedInComparison}
            />
            <Button asChild size="sm" variant="outline">
              <Link href={`/dashboard/notes?university=${university.id}`}>
                <NotebookPen aria-hidden="true" />
                Add note
              </Link>
            </Button>
            {university.isTracked ? (
              <Button asChild size="sm" variant="outline">
                <Link href="/dashboard/applications">
                  In application tracker
                </Link>
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
        </div>
        {websiteUrl || hasPrimarySource ? (
          <div className="flex flex-wrap gap-3">
            {websiteUrl ? (
              <a
                href={websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary text-sm font-medium underline underline-offset-2"
              >
                Official university website
              </a>
            ) : null}
            {hasPrimarySource ? (
              <SourceLink source={university.primarySource} />
            ) : null}
          </div>
        ) : null}
        {description ? (
          <p className="text-muted-foreground max-w-3xl text-sm leading-6">
            {description}
          </p>
        ) : null}
      </header>

      {hasCatalogBenchmarkData(benchmarks) ? (
        <CatalogBenchmarkPanel benchmarks={benchmarks} variant="full" />
      ) : null}

      {availableFacts.length > 0 ? (
        <section
          aria-labelledby="field-facts-heading"
          className="surface-card p-5 sm:p-6"
        >
          <h2 id="field-facts-heading" className="text-lg font-semibold">
            Source-backed details
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Each field carries its own verification status and source.
          </p>
          <div className="mt-4">
            <FieldFactPanel facts={availableFacts} />
          </div>
        </section>
      ) : null}

      {university.programs.length > 0 ? (
        <section
          aria-labelledby="overview-heading"
          className="surface-card p-5 sm:p-6"
        >
          <h2 id="overview-heading" className="text-lg font-semibold">
            Overview
          </h2>
          {hasBenchmarkForKind(benchmarks, "program") ? (
            <BenchmarkStrip benchmarks={benchmarks} kind="program" />
          ) : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {university.programs.map((program) => {
              const details = [
                availableText(degreeLabel(program.degreeLevel)),
                availableText(program.field),
                availableText(program.language),
              ]
                .filter(Boolean)
                .join(" · ");
              const startNote = availableText(program.startNote);
              return (
                <article key={program.id} className="rounded-lg border p-4">
                  <h3 className="font-medium">{program.name}</h3>
                  {details ? (
                    <p className="text-muted-foreground mt-1 text-sm">
                      {details}
                    </p>
                  ) : null}
                  {startNote ? (
                    <p className="mt-2 text-sm">
                      Intake information: {startNote}
                    </p>
                  ) : null}
                  {program.source?.url ? (
                    <p className="mt-2">
                      <SourceLink source={program.source} />
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {programsWithCosts.length > 0 ? (
        <section
          aria-labelledby="costs-heading"
          className="surface-card p-5 sm:p-6"
        >
          <h2 id="costs-heading" className="text-lg font-semibold">
            Costs
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Costs are shown only when supported by a cited source; periods and
            applicant groups are kept as published.
          </p>
          {hasBenchmarkForKind(benchmarks, "tuition") ? (
            <BenchmarkStrip benchmarks={benchmarks} kind="tuition" />
          ) : null}
          <div className="mt-4 space-y-4">
            {programsWithCosts.map((program) => (
              <div key={program.id} className="rounded-lg border p-4">
                <h3 className="font-medium">{program.name}</h3>
                <div className="mt-3 space-y-3">
                  {program.tuition.map((fact, index) => (
                    <div key={`tuition-${index}`} className="space-y-1">
                      <p className="text-sm">
                        Tuition: {money(fact.amountMinor, fact.currency)}{" "}
                        {fact.period}
                        {availableText(fact.applicantGroup)
                          ? ` · ${availableText(fact.applicantGroup)}`
                          : ""}
                      </p>
                      <SourceLink source={fact.source} />
                    </div>
                  ))}
                  {program.costs.map((fact, index) => (
                    <div key={`${fact.kind}-${index}`} className="space-y-1">
                      <p className="text-sm">
                        {COST_LABELS[fact.kind] ?? fact.kind}:{" "}
                        {money(fact.amountMinor, fact.currency)} {fact.period}
                        {availableText(fact.applicantGroup)
                          ? ` · ${availableText(fact.applicantGroup)}`
                          : ""}
                        {availableText(fact.note)
                          ? ` — ${availableText(fact.note)}`
                          : ""}
                      </p>
                      <SourceLink source={fact.source} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {scholarshipEntries.length > 0 ? (
        <section
          aria-labelledby="scholarships-heading"
          className="surface-card p-5 sm:p-6"
        >
          <h2 id="scholarships-heading" className="text-lg font-semibold">
            Scholarships
          </h2>
          {hasBenchmarkForKind(benchmarks, "scholarship") ? (
            <BenchmarkStrip benchmarks={benchmarks} kind="scholarship" />
          ) : null}
          <div className="mt-4 space-y-3">
            {scholarshipEntries.map(({ program, scholarship, summary }) => (
              <article
                key={`${program.id}-${scholarship.slug}`}
                className="rounded-lg border p-4"
              >
                <h3 className="font-medium">
                  <Link
                    href={`/dashboard/scholarships/${scholarship.slug}`}
                    className="text-primary underline underline-offset-2"
                  >
                    {scholarship.name}
                  </Link>
                </h3>
                {summary ? (
                  <p className="text-muted-foreground mt-1 text-sm">
                    {summary}
                  </p>
                ) : null}
                <p className="mt-2">
                  <SourceLink source={scholarship.source} />
                </p>
                <p className="mt-1">
                  <SourceLink source={scholarship.linkSource} />
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Linked to {program.name}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {programsWithRequirements.length > 0 ? (
        <section
          aria-labelledby="requirements-heading"
          className="surface-card p-5 sm:p-6"
        >
          <h2 id="requirements-heading" className="text-lg font-semibold">
            Requirements
          </h2>
          <div className="mt-4 space-y-4">
            {programsWithRequirements.map(({ program, requirements }) => (
              <div key={program.id} className="rounded-lg border p-4">
                <h3 className="font-medium">{program.name}</h3>
                <ul className="mt-3 space-y-3">
                  {requirements.map((requirement, index) => (
                    <li
                      key={`${requirement.kind}-${index}`}
                      className="text-sm"
                    >
                      <p>
                        <span className="font-medium">
                          {REQUIREMENT_LABELS[requirement.kind] ??
                            requirement.kind}
                          :
                        </span>{" "}
                        {requirement.summary}
                      </p>
                      <SourceLink source={requirement.source} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {deadlinePrograms.length > 0 ? (
        <section
          aria-labelledby="deadlines-heading"
          className="surface-card p-5 sm:p-6"
        >
          <h2 id="deadlines-heading" className="text-lg font-semibold">
            Deadlines &amp; intakes
          </h2>
          {hasBenchmarkForKind(benchmarks, "deadline") ? (
            <BenchmarkStrip benchmarks={benchmarks} kind="deadline" />
          ) : null}
          <div className="mt-4 space-y-4">
            {deadlinePrograms.map(
              ({ program, intakes, deadlines, startNote }) => (
                <div key={program.id} className="rounded-lg border p-4">
                  <h3 className="font-medium">{program.name}</h3>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    {intakes.length > 0 || startNote ? (
                      <div>
                        <h4 className="text-sm font-medium">Intakes</h4>
                        {intakes.length > 0 ? (
                          <ul className="mt-2 space-y-2">
                            {intakes.map((intake) => (
                              <li
                                key={`${intake.term ?? "note"}-${intake.source.url}`}
                                className="text-sm"
                              >
                                <p>
                                  {[intake.term, intake.note]
                                    .filter(Boolean)
                                    .join(" — ")}
                                </p>
                                <SourceLink source={intake.source} />
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-muted-foreground mt-2 text-sm">
                            Intake information: {startNote}
                          </p>
                        )}
                      </div>
                    ) : null}
                    {deadlines.length > 0 ? (
                      <div>
                        <h4 className="text-sm font-medium">
                          Application deadlines
                        </h4>
                        <ul className="mt-2 space-y-3">
                          {deadlines.map((deadline, index) => (
                            <li
                              key={`${deadline.cycle}-${index}`}
                              className="text-sm"
                            >
                              <p>
                                {availableText(deadline.cycle)
                                  ? `${availableText(deadline.cycle)}: `
                                  : ""}
                                {deadline.deadlineOn ??
                                  (deadline.deadlineMonthDay
                                    ? `${deadline.deadlineMonthDay} (annual)`
                                    : null)}
                              </p>
                              {availableText(deadline.note) ? (
                                <p className="text-muted-foreground">
                                  {availableText(deadline.note)}
                                </p>
                              ) : null}
                              <SourceLink source={deadline.source} />
                              {university.isTracked && deadline.deadlineOn ? (
                                <form
                                  action={setApplicationDeadlineAction}
                                  className="mt-2"
                                >
                                  <input
                                    type="hidden"
                                    name="universityId"
                                    value={university.id}
                                  />
                                  <input
                                    type="hidden"
                                    name="slug"
                                    value={university.slug}
                                  />
                                  <input
                                    type="hidden"
                                    name="deadline"
                                    value={deadline.deadlineOn}
                                  />
                                  <SubmitButton
                                    size="sm"
                                    variant="outline"
                                    pendingLabel="Adding…"
                                  >
                                    Add to calendar
                                  </SubmitButton>
                                </form>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </div>
              ),
            )}
          </div>
        </section>
      ) : null}

      {sourceRows.length > 0 ? (
        <section
          aria-labelledby="sources-heading"
          className="surface-card p-5 sm:p-6"
        >
          <h2 id="sources-heading" className="text-lg font-semibold">
            Sources
          </h2>
          <p className="text-muted-foreground mt-2 text-sm">
            University and program facts link directly to their cited sources.
            Verification dates are shown beside each fact.
          </p>
          <ul className="mt-3 space-y-2">
            {sourceRows.map(({ label, source }, index) => (
              <li key={`${label ?? "primary"}-${index}`}>
                {label ? (
                  <span className="text-sm font-medium">{label}: </span>
                ) : null}
                <SourceLink source={source} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
