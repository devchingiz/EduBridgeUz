import { CircleHelp, ExternalLink, ShieldCheck, Sparkles } from "lucide-react";

import {
  FieldStatusBadge,
  type FieldFactView,
} from "@/components/catalog/verification";
import { groupFieldFacts } from "@/lib/catalog/fact-groups";
import { formatCheckedOn } from "@/lib/catalog/format";

const INITIAL_VISIBLE_FACTS = 6;

function FactCard({ fact }: { fact: FieldFactView }) {
  const meta = [fact.academicYear, fact.intake, fact.currency, fact.unit]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="border-border/70 bg-card/80 hover:border-primary/25 rounded-xl border p-4 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <p className="text-muted-foreground text-[11px] font-medium tracking-[0.08em] uppercase">
          {fact.label}
        </p>
        <FieldStatusBadge status={fact.status} />
      </div>

      <p className="mt-3 text-[16px] leading-6 font-semibold tracking-[-0.01em] break-words">
        {fact.value ?? (
          <span className="text-muted-foreground font-normal italic">
            Information unavailable
          </span>
        )}
      </p>

      {meta ? (
        <p className="text-muted-foreground mt-1 text-[11.5px]">{meta}</p>
      ) : null}

      {fact.note ? (
        <p className="text-muted-foreground mt-2 text-[11.5px] leading-5">
          {fact.note}
        </p>
      ) : null}

      <div className="border-border/70 text-muted-foreground mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2.5 text-[11px]">
        {fact.sourceUrl ? (
          <a
            href={fact.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary inline-flex items-center gap-1 font-medium underline underline-offset-2"
          >
            {fact.sourceTitle ?? "Open source"}
            <ExternalLink aria-hidden="true" className="size-3" />
          </a>
        ) : (
          <span>No direct source link</span>
        )}
        {fact.verifiedAt ? (
          <span>{formatCheckedOn(fact.verifiedAt)}</span>
        ) : null}
      </div>
    </article>
  );
}

function FactList({ facts }: { facts: FieldFactView[] }) {
  const visible = facts.slice(0, INITIAL_VISIBLE_FACTS);
  const remaining = facts.slice(INITIAL_VISIBLE_FACTS);

  return (
    <div className="grid gap-3">
      {visible.map((fact) => (
        <FactCard key={fact.label} fact={fact} />
      ))}
      {remaining.length > 0 ? (
        <details className="border-border/70 bg-muted/20 group rounded-xl border px-4 py-3">
          <summary className="text-primary flex cursor-pointer list-none items-center justify-between gap-3 text-[12.5px] font-medium [&::-webkit-details-marker]:hidden">
            Show {remaining.length} more field fact
            {remaining.length === 1 ? "" : "s"}
            <span
              aria-hidden="true"
              className="transition-transform group-open:rotate-180"
            >
              ↓
            </span>
          </summary>
          <div className="mt-3 grid gap-3">
            {remaining.map((fact) => (
              <FactCard key={fact.label} fact={fact} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function FactGroup({
  title,
  description,
  facts,
  tone,
}: {
  title: string;
  description: string;
  facts: FieldFactView[];
  tone: "confirmed" | "unconfirmed";
}) {
  const isConfirmed = tone === "confirmed";
  const Icon = isConfirmed ? ShieldCheck : CircleHelp;

  return (
    <div className="min-w-0">
      <div className="mb-4 flex items-start gap-3">
        <span
          className={
            isConfirmed
              ? "flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg"
          }
        >
          <Icon aria-hidden="true" className="size-4" />
        </span>
        <div>
          <h3 className="text-[15px] font-semibold tracking-[-0.01em]">
            {title}
            <span className="text-muted-foreground ml-2 text-[12px] font-normal">
              {facts.length}
            </span>
          </h3>
          <p className="text-muted-foreground mt-0.5 text-[12px] leading-5">
            {description}
          </p>
        </div>
      </div>

      {facts.length > 0 ? (
        <FactList facts={facts} />
      ) : (
        <div className="border-border/70 bg-muted/30 rounded-xl border border-dashed px-4 py-6 text-center">
          <Sparkles
            aria-hidden="true"
            className="text-muted-foreground mx-auto size-4"
          />
          <p className="text-muted-foreground mt-2 text-[12px]">
            {isConfirmed
              ? "No confirmed field values are published yet."
              : "Nothing is flagged as unavailable here."}
          </p>
        </div>
      )}
    </div>
  );
}

/** Field facts presented as a readable, source-first two-column story. */
export function SourceFactGrid({ facts }: { facts: FieldFactView[] }) {
  const { confirmed, unconfirmed } = groupFieldFacts(facts);

  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
      <FactGroup
        title="What we can confirm"
        description="Values with a source and a usable number, date, or label."
        facts={confirmed}
        tone="confirmed"
      />
      <FactGroup
        title="What we could not confirm"
        description="Gaps are shown honestly instead of being filled with guesses."
        facts={unconfirmed}
        tone="unconfirmed"
      />
    </div>
  );
}
