import {
  ArrowUpRight,
  BookOpen,
  CalendarCheck2,
  Globe,
  MapPin,
  Trophy,
} from "lucide-react";

import {
  SourceLine,
  VerificationBadge,
  VerificationNote,
} from "@/components/catalog/verification";
import { FavoriteButton } from "@/components/catalog/favorite-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { countryName } from "@/lib/data/countries";
import { formatDate } from "@/lib/format";
import type { UniversityDetail } from "@/lib/catalog/queries";

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Trophy;
  label: string;
  value: string;
}) {
  return (
    <div className="border-border/70 bg-card/80 rounded-xl border p-3">
      <Icon aria-hidden="true" className="text-primary size-4" />
      <p className="mt-2 text-[15px] leading-5 font-semibold tracking-[-0.01em]">
        {value}
      </p>
      <p className="text-muted-foreground mt-0.5 text-[10.5px] leading-4">
        {label}
      </p>
    </div>
  );
}

export function UniversityHero({
  university,
  programCount,
  signedIn,
}: {
  university: UniversityDetail["university"];
  programCount: number;
  signedIn: boolean;
}) {
  const location =
    [university.city, countryName(university.countryCode)]
      .filter(Boolean)
      .join(", ") || "Location unavailable";

  return (
    <section className="border-border/70 relative overflow-hidden rounded-3xl border shadow-[0_30px_90px_-60px_rgb(49_46_129/0.65)]">
      <div
        aria-hidden="true"
        className="from-brand-soft via-card to-card dark:from-accent/40 dark:via-card dark:to-card absolute inset-0 bg-gradient-to-br"
      />
      <div
        aria-hidden="true"
        className="hero-grid absolute inset-0 opacity-50"
      />
      <div
        aria-hidden="true"
        className="absolute -top-28 -right-20 size-80 rounded-full bg-sky-400/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-32 -left-24 size-72 rounded-full bg-violet-500/10 blur-3xl"
      />

      <div className="relative grid gap-8 p-6 sm:p-9 lg:grid-cols-[1.25fr_.75fr] lg:items-start lg:p-11">
        <div className="min-w-0">
          <div className="flex items-start gap-4 sm:gap-5">
            {university.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={university.logoUrl}
                alt=""
                width={72}
                height={72}
                className="bg-card ring-border/70 size-16 shrink-0 rounded-2xl object-contain p-2 ring-1 sm:size-[72px]"
              />
            ) : (
              <span className="bg-card ring-border/70 text-primary flex size-16 shrink-0 items-center justify-center rounded-2xl ring-1 sm:size-[72px]">
                <BookOpen aria-hidden="true" className="size-7" />
              </span>
            )}

            <div className="min-w-0">
              <p className="eyebrow flex flex-wrap items-center gap-1.5">
                <MapPin aria-hidden="true" className="size-3" />
                {location}
              </p>
              <h1 className="mt-2 text-[2rem] leading-[1.08] font-semibold tracking-[-0.04em] text-balance sm:text-[2.6rem]">
                {university.name}
              </h1>
              {university.shortName ? (
                <p className="text-muted-foreground mt-1.5 text-[13px]">
                  Also known as {university.shortName}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {university.rankingDisplay ? (
              <Badge variant="brand" className="gap-1.5">
                <Trophy aria-hidden="true" className="size-3" />
                QS 2027 · {university.rankingDisplay}
              </Badge>
            ) : (
              <Badge variant="outline">QS 2027 rank unavailable</Badge>
            )}
            {university.continent ? (
              <Badge variant="muted">{university.continent}</Badge>
            ) : null}
            {university.institutionType ? (
              <Badge variant="outline">{university.institutionType}</Badge>
            ) : null}
            <VerificationBadge status={university.provenance.status} />
          </div>

          <p className="text-muted-foreground mt-5 max-w-2xl text-[14px] leading-7 sm:text-[15px]">
            {university.description ??
              `${university.name} is listed in the EduBridge catalog with source-linked records. This profile shows what our sources confirm today, and marks anything they do not.`}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            {university.websiteUrl ? (
              <Button asChild size="sm">
                <a
                  href={university.websiteUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <Globe aria-hidden="true" className="size-4" />
                  Visit official website
                  <ArrowUpRight aria-hidden="true" className="size-3.5" />
                </a>
              </Button>
            ) : (
              <Button size="sm" variant="outline" disabled>
                <Globe aria-hidden="true" className="size-4" />
                Official website unavailable
              </Button>
            )}
            <FavoriteButton
              entityType="UNIVERSITY"
              id={university.id}
              saved={university.isFavorite}
              signedIn={signedIn}
              returnTo={`/universities/${university.slug}`}
            />
          </div>
        </div>

        <aside className="bg-card/85 border-border/70 relative rounded-2xl border p-4 shadow-sm backdrop-blur-sm sm:p-5">
          <p className="eyebrow">At a glance</p>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <Stat
              icon={Trophy}
              label="QS World 2027"
              value={university.rankingDisplay ?? "Unavailable"}
            />
            <Stat
              icon={BookOpen}
              label="Published programs"
              value={String(programCount)}
            />
            <Stat
              icon={CalendarCheck2}
              label="Last checked"
              value={
                university.provenance.verifiedAt
                  ? formatDate(university.provenance.verifiedAt, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "Not checked"
              }
            />
            <Stat
              icon={MapPin}
              label="Location"
              value={university.city || countryName(university.countryCode)}
            />
          </div>

          <div className="border-border/70 mt-4 space-y-1.5 border-t pt-4">
            <SourceLine citation={university.provenance.source} />
            <VerificationNote
              status={university.provenance.status}
              verifiedAt={university.provenance.verifiedAt}
              nextReviewAt={university.provenance.nextReviewAt}
            />
          </div>
        </aside>
      </div>
    </section>
  );
}
