import { ExternalLink, ShieldCheck } from "lucide-react";

import {
  FieldStatusBadge,
  type FieldFactView,
} from "@/components/catalog/verification";
import { filterAvailableFacts } from "@/lib/catalog/fact-groups";
import { formatCheckedOn, plainText } from "@/lib/catalog/format";

const INITIAL_VISIBLE_FACTS = 6;

function FactCard({ fact }: { fact: FieldFactView }) {
  const meta = [fact.academicYear, fact.intake, fact.currency, fact.unit]
    .filter(Boolean)
    .join(" · ");
  const value = plainText(fact.value);
  const note = plainText(fact.note);
  const hasEvidence = Boolean(fact.sourceUrl || fact.verifiedAt);

  return (
    <article className="border-border/70 bg-card/80 hover:border-primary/25 rounded-xl border p-4 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <p className="text-muted-foreground text-[11px] font-medium tracking-[0.08em] uppercase">
          {fact.label}
        </p>
        <FieldStatusBadge status={fact.status} />
      </div>

      <p className="mt-3 text-[16px] leading-6 font-semibold tracking-[-0.01em] break-words">
        {value}
      </p>

      {meta ? (
        <p className="text-muted-foreground mt-1 text-[11.5px]">{meta}</p>
      ) : null}

      {note ? (
        <p className="text-muted-foreground mt-2 text-[11.5px] leading-5">
          {note}
        </p>
      ) : null}

      {hasEvidence ? (
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
          ) : null}
          {fact.verifiedAt ? (
            <span>{formatCheckedOn(fact.verifiedAt)}</span>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function FactList({ facts }: { facts: FieldFactView[] }) {
  const visible = facts.slice(0, INITIAL_VISIBLE_FACTS);
  const remaining = facts.slice(INITIAL_VISIBLE_FACTS);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {visible.map((fact) => (
        <FactCard key={fact.label} fact={fact} />
      ))}
      {remaining.length > 0 ? (
        <details className="border-border/70 bg-muted/20 group rounded-xl border px-4 py-3 sm:col-span-2">
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
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {remaining.map((fact) => (
              <FactCard key={fact.label} fact={fact} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

/** Source-first field facts, with unavailable records omitted. */
export function SourceFactGrid({ facts }: { facts: FieldFactView[] }) {
  const availableFacts = filterAvailableFacts(facts);
  if (availableFacts.length === 0) return null;

  return (
    <div>
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
          <ShieldCheck aria-hidden="true" className="size-4" />
        </span>
        <div>
          <h3 className="text-[15px] font-semibold tracking-[-0.01em]">
            What we can confirm
            <span className="text-muted-foreground ml-2 text-[12px] font-normal">
              {availableFacts.length}
            </span>
          </h3>
          <p className="text-muted-foreground mt-0.5 text-[12px] leading-5">
            Values with a source and a usable number, date, or label.
          </p>
        </div>
      </div>
      <FactList facts={availableFacts} />
    </div>
  );
}
