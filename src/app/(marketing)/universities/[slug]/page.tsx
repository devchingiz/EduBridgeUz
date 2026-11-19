import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";

import { ProgramExplorer } from "@/components/catalog/program-explorer";
import { SourceFactGrid } from "@/components/catalog/source-fact-grid";
import { UniversityHero } from "@/components/catalog/university-hero";
import {
  ReviewBanner,
  SourceLine,
  VerificationNote,
  type FieldFactView,
} from "@/components/catalog/verification";
import { SectionLink } from "@/components/layout/section-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/dal";
import { groupFieldFacts } from "@/lib/catalog/fact-groups";
import { getUniversityBySlug } from "@/lib/catalog/queries";
import { countryName } from "@/lib/data/countries";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "facts", label: "Facts" },
  { id: "programs", label: "Programs" },
  { id: "sources", label: "Sources" },
  { id: "next", label: "What next" },
] as const;

function DetailSectionNav() {
  return (
    <nav
      aria-label="University profile sections"
      className="bg-background/85 border-border/70 sticky top-16 z-30 mt-6 rounded-xl border p-1.5 shadow-sm backdrop-blur-xl"
    >
      <ul className="flex scrollbar-none gap-1 overflow-x-auto">
        {SECTIONS.map((section, index) => (
          <li key={section.id} className="shrink-0">
            <SectionLink
              href={`#${section.id}`}
              className="text-muted-foreground hover:bg-muted/70 hover:text-foreground inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-medium transition-colors"
            >
              <span className="text-muted-foreground/70 font-mono text-[10px]">
                {String(index + 1).padStart(2, "0")}
              </span>
              {section.label}
            </SectionLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-balance sm:text-3xl">
          {title}
        </h2>
        <p className="text-muted-foreground mt-2 text-[13.5px] leading-6">
          {description}
        </p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const detail = await getUniversityBySlug(slug);
  if (!detail) return { title: "University not found" };

  const { university } = detail;
  const description = `${university.name} in ${university.city}, ${countryName(
    university.countryCode,
  )}. Program facts are source-linked and carry a verification date.`;

  return {
    title: university.name,
    description,
    alternates: { canonical: `/universities/${university.slug}` },
    openGraph: { title: university.name, description, type: "website" },
  };
}

export default async function UniversityPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await getCurrentUser();
  const detail = await getUniversityBySlug(slug, session?.id);
  if (!detail) notFound();

  const { university, programs } = detail;
  const fieldFacts: FieldFactView[] = university.fieldFacts.map((fact) => ({
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
  }));
  const factGroups = groupFieldFacts(fieldFacts);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollegeOrUniversity",
    name: university.name,
    ...(university.websiteUrl ? { url: university.websiteUrl } : {}),
    address: {
      "@type": "PostalAddress",
      addressLocality: university.city,
      addressCountry: university.countryCode,
    },
  };

  return (
    <div className="site-container pt-8 pb-16 sm:pt-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <nav
        aria-label="Breadcrumb"
        className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-[12.5px]"
      >
        <Link
          href="/universities"
          className="hover:text-foreground inline-flex items-center gap-1.5"
        >
          All universities
        </Link>
        <ChevronRight aria-hidden="true" className="size-3.5" />
        <span className="text-foreground/80 font-medium">
          {university.shortName ?? university.name}
        </span>
      </nav>

      <div id="overview" className="scroll-mt-32">
        <UniversityHero
          university={university}
          programCount={programs.length}
          signedIn={Boolean(session)}
        />
      </div>

      <DetailSectionNav />

      <section id="facts" className="mt-12 scroll-mt-32">
        <SectionHeading
          eyebrow="01 / Evidence"
          title="Read the evidence, not a sales pitch"
          description="Every field below keeps its own status, source link, and verification date. Confirmed values and honest gaps are separated so you can judge the record quickly."
          action={
            <div className="flex flex-wrap gap-2">
              <Badge variant="success">
                {factGroups.confirmed.length} usable values
              </Badge>
              <Badge variant="muted">
                {factGroups.unconfirmed.length} explicit gaps
              </Badge>
            </div>
          }
        />

        <div className="surface-card mt-5 p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="bg-accent text-accent-foreground flex size-9 items-center justify-center rounded-lg">
                <ShieldCheck aria-hidden="true" className="size-4" />
              </span>
              <div>
                <p className="text-[14px] font-semibold">
                  Source-backed details
                </p>
                <p className="text-muted-foreground text-[12px]">
                  Open any source link to check the original wording.
                </p>
              </div>
            </div>
            <Badge variant="outline">{fieldFacts.length} field records</Badge>
          </div>

          <div className="mt-6">
            <SourceFactGrid facts={fieldFacts} />
          </div>
        </div>
      </section>

      <section id="programs" className="mt-14 scroll-mt-32">
        <SectionHeading
          eyebrow="02 / Study options"
          title="Explore programs from this university"
          description="Search the published program records, filter by degree level, and open the ones that match your field."
          action={
            <Badge variant="brand">
              {programs.length} published program
              {programs.length === 1 ? "" : "s"}
            </Badge>
          }
        />

        {programs.length > 0 ? (
          <div className="mt-5">
            <ProgramExplorer
              programs={programs}
              universitySlug={university.slug}
            />
          </div>
        ) : (
          <div className="surface-card mt-5 px-6 py-12 text-center">
            <span className="bg-accent text-accent-foreground mx-auto flex size-11 items-center justify-center rounded-xl">
              <BookOpen aria-hidden="true" className="size-5" />
            </span>
            <p className="mt-4 text-[15px] font-semibold">
              No program records are published yet
            </p>
            <p className="text-muted-foreground mx-auto mt-2 max-w-md text-[12.5px] leading-6">
              We only publish a program after its facts have a source-backed
              record. Until then, the university&apos;s official website remains
              the authoritative source for study options.
            </p>
          </div>
        )}
      </section>

      <section id="sources" className="mt-14 scroll-mt-32">
        <SectionHeading
          eyebrow="03 / Provenance"
          title="Know exactly where this profile comes from"
          description="The primary source and review dates stay attached to the profile. Nothing on this page is presented as confirmed without a recorded basis."
        />

        <div className="surface-card mt-5 grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.1fr_.9fr]">
          <div className="min-w-0">
            <p className="eyebrow">Primary catalog record</p>
            <p className="mt-2 text-[17px] font-semibold tracking-[-0.01em]">
              {university.provenance.source?.publisher ??
                "No primary source recorded"}
            </p>
            <div className="mt-3">
              <SourceLine citation={university.provenance.source} />
            </div>
            <div className="mt-3">
              <VerificationNote
                status={university.provenance.status}
                verifiedAt={university.provenance.verifiedAt}
                nextReviewAt={university.provenance.nextReviewAt}
              />
            </div>
            <div className="mt-4">
              <ReviewBanner
                status={university.provenance.status}
                entityLabel="university"
              />
            </div>
          </div>

          <div className="border-border/70 bg-muted/20 rounded-xl border p-4 sm:p-5">
            <p className="eyebrow">How to read this page</p>
            <ul className="mt-4 space-y-4 text-[12.5px] leading-6">
              <li className="flex gap-3">
                <span className="text-primary font-mono text-[11px]">01</span>
                <p className="text-muted-foreground">
                  <span className="text-foreground font-medium">
                    Usable values
                  </span>{" "}
                  have a status and a source link you can open yourself.
                </p>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-mono text-[11px]">02</span>
                <p className="text-muted-foreground">
                  <span className="text-foreground font-medium">
                    Explicit gaps
                  </span>{" "}
                  stay visible instead of being replaced by a guess.
                </p>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-mono text-[11px]">03</span>
                <p className="text-muted-foreground">
                  <span className="text-foreground font-medium">
                    Official pages win
                  </span>{" "}
                  when a university has changed a detail since our check date.
                </p>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section id="next" className="mt-14 scroll-mt-32">
        <div className="border-border/70 from-brand-soft via-card to-card dark:from-accent/30 dark:via-card dark:to-card relative overflow-hidden rounded-3xl border bg-gradient-to-br p-6 sm:p-9">
          <div
            aria-hidden="true"
            className="hero-grid absolute inset-0 opacity-60"
          />
          <div
            aria-hidden="true"
            className="absolute -top-24 -right-16 size-64 rounded-full bg-sky-400/15 blur-3xl"
          />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <p className="eyebrow inline-flex items-center gap-1.5">
                <Sparkles aria-hidden="true" className="size-3" />
                Keep exploring
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-balance sm:text-3xl">
                Turn this profile into a shortlist.
              </h2>
              <p className="text-muted-foreground mt-2 text-[13.5px] leading-6">
                Compare your options, save what matters, and find funding routes
                without losing the source trail you just read.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/universities">
                  Browse all universities
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <SectionLink href="/#scholarships">
                  Find scholarships
                </SectionLink>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <p className="text-muted-foreground mt-10 max-w-3xl text-[11.5px] leading-5">
        Catalog records carry source links and verification dates. If an
        official page has changed since the date shown, treat the official page
        as authoritative and let us know so the record can be re-reviewed.
      </p>
    </div>
  );
}
