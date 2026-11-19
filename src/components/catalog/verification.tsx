import { ExternalLink, ShieldAlert, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  FIELD_VERIFICATION_LABELS,
  VERIFICATION_DESCRIPTIONS,
  VERIFICATION_LABELS,
  type FieldVerificationStatusValue,
  type VerificationStatusValue,
} from "@/lib/catalog/constants";
import {
  formatCheckedOn,
  verificationBadgeVariant,
} from "@/lib/catalog/format";
import type { CitationDto } from "@/lib/catalog/provenance";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Provenance UI. Every fact rendered on a catalog page passes through one of
 * these components, so a value and its source are never separated.
 */

export function VerificationBadge({
  status,
  className,
}: {
  status: VerificationStatusValue;
  className?: string;
}) {
  return (
    <Badge variant={verificationBadgeVariant(status)} className={className}>
      {status === "VERIFIED" ? (
        <ShieldCheck aria-hidden="true" />
      ) : status === "NEEDS_REVIEW" ? (
        <ShieldAlert aria-hidden="true" />
      ) : null}
      {VERIFICATION_LABELS[status]}
    </Badge>
  );
}

export function VerificationNote({
  status,
  verifiedAt,
  nextReviewAt,
  className,
}: {
  status: VerificationStatusValue;
  verifiedAt: string | null;
  nextReviewAt: string | null;
  className?: string;
}) {
  return (
    <p className={cn("text-muted-foreground text-[12px] leading-5", className)}>
      <span className="text-foreground font-medium">
        {VERIFICATION_LABELS[status]}.
      </span>{" "}
      {VERIFICATION_DESCRIPTIONS[status]} {formatCheckedOn(verifiedAt)}
      {nextReviewAt ? ` · Next review by ${formatDate(nextReviewAt)}` : null}
    </p>
  );
}

export function SourceLine({
  citation,
  className,
  showChecked = true,
}: {
  citation: CitationDto | null;
  className?: string;
  showChecked?: boolean;
}) {
  if (!citation) {
    return (
      <p className={cn("text-muted-foreground text-[12px]", className)}>
        No source citation recorded.
      </p>
    );
  }

  return (
    <p className={cn("text-muted-foreground text-[12px] leading-5", className)}>
      Source:{" "}
      <a
        href={citation.url}
        target="_blank"
        rel="noreferrer noopener"
        className="text-foreground decoration-border hover:decoration-foreground inline-flex items-center gap-1 font-medium underline underline-offset-2"
      >
        {citation.publisher}
        <ExternalLink aria-hidden="true" className="size-3" />
      </a>
      {showChecked ? ` · ${formatCheckedOn(citation.verifiedAt)}` : null}
    </p>
  );
}

export function ReviewBanner({
  status,
  entityLabel,
}: {
  status: VerificationStatusValue;
  entityLabel: string;
}) {
  if (status !== "NEEDS_REVIEW") return null;

  return (
    <div
      role="status"
      className="rounded-xl border border-amber-600/20 bg-amber-50/70 px-4 py-3 text-[13px] leading-6 text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200"
    >
      <p className="font-medium">This {entityLabel} is awaiting re-review.</p>
      <p className="mt-0.5 opacity-90">
        It was checked against an official source before, but its review window
        has passed or a reviewer flagged a change. Use the source link to
        confirm the current details before you rely on them.
      </p>
    </div>
  );
}

export function UnknownValue({
  children = "Not published",
}: {
  children?: React.ReactNode;
}) {
  return <span className="text-muted-foreground italic">{children}</span>;
}

/**
 * A compact field-level status chip. Distinct from VerificationBadge, which
 * describes a whole record; this describes one fact and its verification state.
 */
export function FieldStatusBadge({
  status,
}: {
  status: FieldVerificationStatusValue;
}) {
  const variant =
    status === "VERIFIED"
      ? "success"
      : status === "PARTIALLY_VERIFIED" || status === "NOT_VERIFIED"
        ? "warning"
        : "outline";
  return <Badge variant={variant}>{FIELD_VERIFICATION_LABELS[status]}</Badge>;
}

export type FieldFactView = {
  label: string;
  value: string | null;
  status: FieldVerificationStatusValue;
  sourceUrl: string | null;
  sourceTitle: string | null;
  verifiedAt: string | null;
  academicYear?: string | null;
  intake?: string | null;
  currency?: string | null;
  unit?: string | null;
  note?: string | null;
};

/** Renders sourced, field-level facts with an explicit unavailable state. */
export function FieldFactPanel({ facts }: { facts: FieldFactView[] }) {
  if (facts.length === 0) return null;

  return (
    <dl className="divide-border divide-y">
      {facts.map((fact) => (
        <div key={fact.label} className="py-3 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <dt className="text-[13px] font-medium">{fact.label}</dt>
            <FieldStatusBadge status={fact.status} />
          </div>
          <dd className="mt-1 text-[13px] leading-6">
            {fact.value ?? (
              <span className="text-muted-foreground italic">
                Information unavailable
              </span>
            )}
            {fact.currency || fact.unit || fact.academicYear || fact.intake ? (
              <span className="text-muted-foreground ml-1 text-[12px]">
                {[fact.academicYear, fact.intake, fact.currency, fact.unit]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            ) : null}
            {fact.sourceUrl ? (
              <a
                href={fact.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-primary ml-2 inline-flex items-center gap-1 text-[12px] underline underline-offset-2"
              >
                {fact.sourceTitle ?? "Source"}
                <ExternalLink aria-hidden="true" className="size-3" />
              </a>
            ) : null}
            {fact.verifiedAt ? (
              <span className="text-muted-foreground ml-2 text-[12px]">
                {formatCheckedOn(fact.verifiedAt)}
              </span>
            ) : null}
            {fact.note ? (
              <p className="text-muted-foreground mt-0.5 text-[12px]">
                {fact.note}
              </p>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
