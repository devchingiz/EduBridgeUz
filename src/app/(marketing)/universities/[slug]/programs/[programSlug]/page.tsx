import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, CheckCircle2, Wallet } from "lucide-react";

import {
  ReviewBanner,
  SourceLine,
  UnknownValue,
  VerificationBadge,
  VerificationNote,
} from "@/components/catalog/verification";
import { Badge } from "@/components/ui/badge";
import {
  deadlineState,
  formatDeadlineLabel,
  formatDeadlineWindow,
  formatMoney,
  formatStart,
} from "@/lib/catalog/format";
import { REQUIREMENT_LABELS } from "@/lib/catalog/constants";
import { getProgramDetail } from "@/lib/catalog/queries";
import { degreeLabel } from "@/lib/data/fields";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string; programSlug: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug, programSlug } = await params;
  const detail = await getProgramDetail(slug, programSlug);
  if (!detail) return { title: "Program not found" };

  const { program, university } = detail;
  const parts = [
    `${degreeLabel(program.degreeLevel)} in ${program.field} at ${university.name}.`,
    program.durationMonths ? `${program.durationMonths} months.` : null,
    "Every fact carries an official source and verification date.",
  ].filter(Boolean);

  return {
    title: `${program.name} — ${university.name}`,
    description: parts.join(" "),
    alternates: {
      canonical: `/universities/${university.slug}/programs/${program.slug}`,
    },
  };
}

const DEADLINE_BADGE = {
  open: { label: "Open now", variant: "success" as const },
  upcoming: { label: "Upcoming", variant: "brand" as const },
  closed: { label: "Closed", variant: "muted" as const },
  unknown: { label: "Check source", variant: "outline" as const },
};

export default async function ProgramPage({ params }: PageProps) {
  const { slug, programSlug } = await params;
  const detail = await getProgramDetail(slug, programSlug);
  if (!detail) notFound();

  const { program, university, requirements, tuition, deadlines } = detail;
  const start = formatStart(program.startMonths, program.startNote);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: program.name,
    url: `${siteConfig.url}/universities/${university.slug}/programs/${program.slug}`,
    provider: {
      "@type": "CollegeOrUniversity",
      name: university.name,
    },
    educationalCredentialAwarded: degreeLabel(program.degreeLevel),
    ...(program.durationMonths
      ? { timeRequired: `P${program.durationMonths}M` }
      : {}),
  };

  return (
    <div className="site-container py-10 sm:py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-[12.5px]">
          <li>
            <Link
              href="/universities"
              className="hover:text-foreground inline-flex items-center gap-1.5"
            >
              <ArrowLeft aria-hidden="true" className="size-3.5" />
              Universities
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href={`/universities/${university.slug}`}
              className="hover:text-foreground"
            >
              {university.name}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-foreground">
            {program.name}
          </li>
        </ol>
      </nav>

      <header className="surface-card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="eyebrow">
              {degreeLabel(program.degreeLevel)} · {program.field}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-balance sm:text-4xl">
              {program.name}
            </h1>
            <p className="text-muted-foreground mt-2 text-[13px]">
              <Link
                href={`/universities/${university.slug}`}
                className="hover:text-foreground font-medium underline underline-offset-2"
              >
                {university.name}
              </Link>
            </p>
          </div>
          <VerificationBadge status={program.provenance.status} />
        </div>

        <dl className="border-border mt-6 grid gap-x-6 gap-y-4 border-t pt-5 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              Duration
            </dt>
            <dd className="mt-1 text-[13.5px]">
              {program.durationMonths ? (
                `${program.durationMonths} months`
              ) : (
                <UnknownValue />
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              Credits
            </dt>
            <dd className="mt-1 text-[13.5px]">
              {program.credits ? (
                `${program.credits} credits`
              ) : (
                <UnknownValue />
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              Language
            </dt>
            <dd className="mt-1 text-[13.5px]">
              {program.language ?? <UnknownValue />}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              Starts
            </dt>
            <dd className="mt-1 text-[13.5px]">{start ?? <UnknownValue />}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              Field
            </dt>
            <dd className="mt-1 text-[13.5px]">{program.field}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              Degree
            </dt>
            <dd className="mt-1 text-[13.5px]">
              {degreeLabel(program.degreeLevel)}
            </dd>
          </div>
        </dl>

        <div className="border-border mt-5 space-y-1.5 border-t pt-4">
          <SourceLine citation={program.provenance.source} />
          <VerificationNote
            status={program.provenance.status}
            verifiedAt={program.provenance.verifiedAt}
            nextReviewAt={program.provenance.nextReviewAt}
          />
        </div>
      </header>

      <div className="mt-6">
        <ReviewBanner
          status={program.provenance.status}
          entityLabel="program"
        />
      </div>

      <section aria-labelledby="requirements" className="mt-10">
        <h2
          id="requirements"
          className="text-xl font-semibold tracking-[-0.02em]"
        >
          Admission requirements
        </h2>
        {requirements.length === 0 ? (
          <div className="surface-card mt-4 px-6 py-8">
            <p className="text-[13px] font-medium">
              No requirements have been published yet
            </p>
            <p className="text-muted-foreground mt-1.5 max-w-xl text-[12.5px] leading-6">
              This does not mean there are none. It means a reviewer has not
              recorded a source-backed requirement for this program. Check the
              official program page before applying.
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
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

      <section aria-labelledby="tuition" className="mt-10">
        <div className="flex items-center gap-2">
          <Wallet aria-hidden="true" className="text-muted-foreground size-4" />
          <h2 id="tuition" className="text-xl font-semibold tracking-[-0.02em]">
            Tuition
          </h2>
        </div>
        {tuition.length === 0 ? (
          <div className="surface-card mt-4 px-6 py-8">
            <p className="text-[13px] font-medium">
              No tuition amount has been verified
            </p>
            <p className="text-muted-foreground mt-1.5 max-w-xl text-[12.5px] leading-6">
              The official pages we checked do not state a single amount for
              this program, or the amount depends on a group we could not
              confirm. We leave it blank rather than estimate. Fees can differ
              by nationality and campus, so check the provider&apos;s fee page.
            </p>
          </div>
        ) : (
          <div className="surface-card divide-border mt-4 divide-y">
            {tuition.map((fact) => (
              <div key={fact.id} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[15px] font-semibold">
                    {formatMoney(fact.amountMinor, fact.currency)}{" "}
                    <span className="text-muted-foreground text-[12px] font-normal">
                      {fact.period}
                    </span>
                  </p>
                  {fact.applicantGroup ? (
                    <Badge variant="brand">{fact.applicantGroup}</Badge>
                  ) : null}
                </div>
                {fact.note ? (
                  <p className="text-muted-foreground mt-1 text-[12.5px] leading-5">
                    {fact.note}
                  </p>
                ) : null}
                <SourceLine
                  citation={fact.provenance.source}
                  className="mt-2"
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="deadlines" className="mt-10">
        <div className="flex items-center gap-2">
          <CalendarClock
            aria-hidden="true"
            className="text-muted-foreground size-4"
          />
          <h2
            id="deadlines"
            className="text-xl font-semibold tracking-[-0.02em]"
          >
            Deadlines
          </h2>
        </div>
        {deadlines.length === 0 ? (
          <div className="surface-card mt-4 px-6 py-8">
            <p className="text-[13px] font-medium">
              No deadline has been verified
            </p>
            <p className="text-muted-foreground mt-1.5 max-w-xl text-[12.5px] leading-6">
              Deadlines change every cycle. We only show a date when an official
              page states it, so check the provider&apos;s admissions page for
              the current round.
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {deadlines.map((deadline) => {
              const state = DEADLINE_BADGE[deadlineState(deadline)];
              const window = formatDeadlineWindow(deadline);
              return (
                <li key={deadline.id} className="surface-card p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold">
                        {deadline.cycle}
                        {deadline.applicantGroup ? (
                          <span className="text-muted-foreground font-normal">
                            {" "}
                            · {deadline.applicantGroup}
                          </span>
                        ) : null}
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

      <aside className="surface-card mt-10 flex gap-3 p-4">
        <CheckCircle2
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
        />
        <p className="text-muted-foreground text-[11.5px] leading-5">
          This page shows what a reviewer recorded, not an admission decision.
          Requirements and dates can change without notice. Always confirm on
          the official page before you apply.
        </p>
      </aside>
    </div>
  );
}
