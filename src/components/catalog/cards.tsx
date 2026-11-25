import {
  ArrowUpRight,
  CalendarClock,
  GraduationCap,
  MapPin,
} from "lucide-react";
import Link from "next/link";

import { VerificationBadge } from "@/components/catalog/verification";
import { FavoriteButton } from "@/components/catalog/favorite-button";
import { Badge } from "@/components/ui/badge";
import {
  ELIGIBILITY_LABELS,
  FUNDING_LABELS,
  type EligibilityScopeValue,
  type FundingTypeValue,
} from "@/lib/catalog/constants";
import { plainText } from "@/lib/catalog/format";
import { availableText } from "@/lib/catalog/fact-groups";
import { countryName } from "@/lib/data/countries";
import { degreeLabel } from "@/lib/data/fields";
import type {
  ScholarshipListItem,
  UniversityListItem,
} from "@/lib/catalog/queries";

export function UniversityCard({
  university,
  signedIn,
}: {
  university: UniversityListItem;
  signedIn: boolean;
}) {
  const description = plainText(university.description);
  const institutionType = availableText(university.institutionType);
  const city = plainText(university.city)
    ?.replace(/[,;]+$/, "")
    .trim();
  const location = [city, countryName(university.countryCode)]
    .filter(Boolean)
    .join(", ");
  return (
    <article className="surface-card hover:border-primary/25 group flex h-full flex-col gap-4 p-5 transition-colors">
      <div className="flex items-start justify-between gap-3">
        {university.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={university.logoUrl}
            alt=""
            width={40}
            height={40}
            loading="lazy"
            className="size-10 shrink-0 rounded-md object-contain"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold tracking-[-0.01em]">
            <Link
              href={`/universities/${university.slug}`}
              className="focus-visible:ring-ring/40 rounded-sm outline-none focus-visible:ring-2"
            >
              {university.name}
            </Link>
          </h3>
          <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]">
            <span className="inline-flex items-center gap-1">
              <MapPin aria-hidden="true" className="size-3.5" />
              {location}
            </span>
            {university.shortName ? (
              <span className="text-muted-foreground/70">
                · {university.shortName}
              </span>
            ) : null}
          </p>
          {university.rankingDisplay ? (
            <p className="text-muted-foreground mt-0.5 text-[12px]">
              QS World University Rankings 2027:{" "}
              <span className="text-foreground font-medium">
                {university.rankingDisplay}
              </span>
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <VerificationBadge status={university.status} />
          <FavoriteButton
            entityType="UNIVERSITY"
            id={university.id}
            saved={university.isFavorite}
            signedIn={signedIn}
            returnTo="/universities"
            compact
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {university.featured ? <Badge variant="brand">Featured</Badge> : null}
        {university.degrees.map((degree) => (
          <Badge key={degree} variant="muted">
            {degreeLabel(degree)}
          </Badge>
        ))}
        {university.fields
          .map(availableText)
          .filter((field): field is string => Boolean(field))
          .slice(0, 2)
          .map((field) => (
            <Badge key={field} variant="brand">
              {field}
            </Badge>
          ))}
        {university.continent ? (
          <Badge variant="muted">{university.continent}</Badge>
        ) : null}
        {institutionType ? (
          <Badge variant="outline">{institutionType}</Badge>
        ) : null}
        {university.websiteUrl ? (
          <a
            href={university.websiteUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary inline-flex items-center gap-1 text-[12px] underline underline-offset-2"
          >
            Official site
            <ArrowUpRight aria-hidden="true" className="size-3" />
          </a>
        ) : null}
      </div>

      {description ? (
        <p className="text-muted-foreground line-clamp-2 text-[12.5px] leading-5">
          {description}
        </p>
      ) : null}

      <div className="border-border mt-auto flex items-center justify-between border-t pt-3">
        <p className="text-muted-foreground text-[12px]">
          {university.programCount === 1
            ? "1 published program"
            : `${university.programCount} published programs`}
        </p>
        <Link
          href={`/universities/${university.slug}`}
          className="text-primary inline-flex items-center gap-1 text-[12.5px] font-medium hover:underline hover:underline-offset-2"
        >
          View profile
          <ArrowUpRight aria-hidden="true" className="size-3.5" />
        </Link>
      </div>
    </article>
  );
}

export function ProgramRow({
  program,
  universitySlug,
}: {
  program: {
    slug: string;
    name: string;
    degreeLevel: string;
    field: string;
    language: string | null;
    durationMonths: number | null;
    credits: number | null;
    status: UniversityListItem["status"];
    requirementCount: number;
    tuitionCount: number;
    deadlineCount: number;
  };
  universitySlug: string;
}) {
  const href = `/universities/${universitySlug}/programs/${program.slug}`;

  return (
    <article className="surface-card hover:border-primary/25 flex flex-col gap-3 p-4 transition-colors sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h3 className="text-[14px] font-semibold">
          <Link
            href={href}
            className="focus-visible:ring-ring/40 rounded-sm outline-none focus-visible:ring-2"
          >
            {program.name}
          </Link>
        </h3>
        <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
          <span className="inline-flex items-center gap-1">
            <GraduationCap aria-hidden="true" className="size-3.5" />
            {degreeLabel(program.degreeLevel)}
          </span>
          <span>· {program.field}</span>
          {program.durationMonths ? (
            <span>· {program.durationMonths} months</span>
          ) : null}
          {program.credits ? <span>· {program.credits} credits</span> : null}
          {program.language ? <span>· {program.language}</span> : null}
        </p>
        <p className="text-muted-foreground mt-1.5 text-[11.5px]">
          {program.requirementCount} requirement
          {program.requirementCount === 1 ? "" : "s"} · {program.tuitionCount}{" "}
          tuition fact
          {program.tuitionCount === 1 ? "" : "s"} · {program.deadlineCount}{" "}
          deadline{program.deadlineCount === 1 ? "" : "s"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <VerificationBadge status={program.status} />
        <Link
          href={href}
          className="text-primary inline-flex items-center gap-1 text-[12.5px] font-medium hover:underline hover:underline-offset-2"
        >
          Details
          <ArrowUpRight aria-hidden="true" className="size-3.5" />
        </Link>
      </div>
    </article>
  );
}

export function ScholarshipCard({
  scholarship,
  signedIn,
}: {
  scholarship: ScholarshipListItem;
  signedIn: boolean;
}) {
  return (
    <article className="surface-card hover:border-primary/25 flex h-full flex-col gap-4 p-5 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold tracking-[-0.01em]">
            <Link
              href={`/scholarships/${scholarship.slug}`}
              className="focus-visible:ring-ring/40 rounded-sm outline-none focus-visible:ring-2"
            >
              {scholarship.name}
            </Link>
          </h3>
          <p className="text-muted-foreground mt-1 text-[12.5px]">
            {scholarship.providerName}
            {scholarship.hostCountryCode
              ? ` · ${countryName(scholarship.hostCountryCode)}`
              : " · Multiple host countries"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <VerificationBadge status={scholarship.status} />
          <FavoriteButton
            entityType="SCHOLARSHIP"
            id={scholarship.id}
            saved={scholarship.isFavorite}
            signedIn={signedIn}
            returnTo="/scholarships"
            compact
          />
        </div>
      </div>

      <p className="text-muted-foreground line-clamp-3 text-[12.5px] leading-5">
        {scholarship.summary}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {scholarship.featured ? <Badge variant="brand">Featured</Badge> : null}
        <Badge variant="brand">
          {FUNDING_LABELS[scholarship.fundingType as FundingTypeValue]}
        </Badge>
        {scholarship.degreeLevels.slice(0, 2).map((degree) => (
          <Badge key={degree} variant="muted">
            {degreeLabel(degree)}
          </Badge>
        ))}
        <Badge variant="outline">
          {
            ELIGIBILITY_LABELS[
              scholarship.nationalityScope as EligibilityScopeValue
            ]
          }
        </Badge>
      </div>

      <div className="border-border mt-auto flex items-center justify-between border-t pt-3">
        <p className="text-muted-foreground inline-flex items-center gap-1 text-[12px]">
          <CalendarClock aria-hidden="true" className="size-3.5" />
          {scholarship.deadlineCount === 0
            ? "No dated cycle recorded"
            : `${scholarship.deadlineCount} deadline${scholarship.deadlineCount === 1 ? "" : "s"}`}
        </p>
        <Link
          href={`/scholarships/${scholarship.slug}`}
          className="text-primary inline-flex items-center gap-1 text-[12.5px] font-medium hover:underline hover:underline-offset-2"
        >
          View scholarship
          <ArrowUpRight aria-hidden="true" className="size-3.5" />
        </Link>
      </div>
    </article>
  );
}
