import { ArrowUpRight, CalendarClock, MapPin } from "lucide-react";
import Link from "next/link";

import { FavoriteButton } from "@/components/catalog/favorite-button";
import { VerificationBadge } from "@/components/catalog/verification";
import { Badge } from "@/components/ui/badge";
import {
  ELIGIBILITY_LABELS,
  FUNDING_LABELS,
  type EligibilityScopeValue,
  type FundingTypeValue,
} from "@/lib/catalog/constants";
import type { ScholarshipListItem } from "@/lib/catalog/queries";
import { countryName } from "@/lib/data/countries";
import { degreeLabel } from "@/lib/data/fields";

export function DashboardScholarshipCard({
  scholarship,
}: {
  scholarship: ScholarshipListItem;
}) {
  const href = `/dashboard/scholarships/${scholarship.slug}`;

  return (
    <article className="surface-card hover:border-primary/30 flex h-full flex-col gap-4 p-5 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-[10.5px] font-semibold tracking-[0.1em] uppercase">
            {scholarship.providerName}
          </p>
          <h3 className="mt-1 text-[15px] leading-5 font-semibold tracking-[-0.01em]">
            <Link
              href={href}
              className="focus-visible:ring-ring/40 rounded-sm outline-none focus-visible:ring-2"
            >
              {scholarship.name}
            </Link>
          </h3>
          <p className="text-muted-foreground mt-1.5 flex items-center gap-1.5 text-[11.5px]">
            <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
            {scholarship.hostCountryCode
              ? countryName(scholarship.hostCountryCode)
              : "Multiple host countries"}
          </p>
        </div>
        <FavoriteButton
          entityType="SCHOLARSHIP"
          id={scholarship.id}
          saved={scholarship.isFavorite}
          signedIn
          returnTo="/dashboard/scholarships"
          compact
        />
      </div>

      <p className="text-muted-foreground line-clamp-3 text-[12.5px] leading-5">
        {scholarship.summary}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {scholarship.featured ? <Badge variant="brand">Featured</Badge> : null}
        <Badge variant="brand">
          {FUNDING_LABELS[scholarship.fundingType as FundingTypeValue] ??
            "Funding"}
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
        <VerificationBadge status={scholarship.status} />
      </div>

      <div className="border-border mt-auto flex items-center justify-between gap-3 border-t pt-3">
        <p className="text-muted-foreground inline-flex items-center gap-1.5 text-[11.5px]">
          <CalendarClock aria-hidden="true" className="size-3.5" />
          {scholarship.deadlineCount === 0
            ? "No dated cycle recorded"
            : `${scholarship.deadlineCount} deadline${scholarship.deadlineCount === 1 ? "" : "s"}`}
        </p>
        <Link
          href={href}
          className="text-primary inline-flex items-center gap-1 text-[12px] font-medium hover:underline hover:underline-offset-2"
        >
          Open
          <ArrowUpRight aria-hidden="true" className="size-3.5" />
        </Link>
      </div>
    </article>
  );
}
