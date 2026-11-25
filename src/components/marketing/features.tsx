import {
  Award,
  CalendarDays,
  Check,
  CircleHelp,
  Clock3,
  FileText,
  KanbanSquare,
  Link2,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { SectionLink } from "@/components/layout/section-link";
import { Reveal } from "@/components/marketing/reveal";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Badge } from "@/components/ui/badge";
import type { FeaturesContent } from "@/lib/cms/homepage-content";

const kanbanColumns = [
  {
    title: "Researching",
    dot: "bg-sky-500",
    items: [
      {
        name: "University of Toronto",
        meta: "Master's · Computer Science",
      },
      { name: "Lund University", meta: "Master's · Engineering" },
    ],
  },
  {
    title: "Preparing docs",
    dot: "bg-amber-500",
    items: [
      { name: "TU Munich", meta: "CV + transcript" },
      { name: "KAIST", meta: "Scholarship essay" },
    ],
  },
  {
    title: "Submitted",
    dot: "bg-emerald-500",
    items: [
      {
        name: "University of Amsterdam",
        meta: "Awaiting response",
      },
    ],
  },
];

const deadlines = [
  {
    month: "NOV",
    day: "28",
    title: "Documents due",
    meta: "4 of 6 ready",
    tone: "text-amber-600 dark:text-amber-400",
  },
  {
    month: "DEC",
    day: "05",
    title: "Scholarship essay",
    meta: "Draft saved",
    tone: "text-indigo-600 dark:text-indigo-400",
  },
  {
    month: "DEC",
    day: "12",
    title: "Interview window",
    meta: "Time to prepare",
    tone: "text-emerald-600 dark:text-emerald-400",
  },
];

const documents = [
  { name: "Passport", meta: "PDF · Ready", ready: true },
  { name: "Academic transcript", meta: "PDF · Ready", ready: true },
  { name: "IELTS certificate", meta: "Missing", ready: false },
];

function FeatureHeading({
  icon: Icon,
  title,
  badge,
}: {
  icon: typeof ShieldCheck;
  title: string;
  badge?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className="border-primary/10 bg-accent text-primary flex size-8 items-center justify-center rounded-lg border">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <h3 className="text-[13.5px] font-semibold tracking-[-0.01em]">
          {title}
        </h3>
      </div>
      {badge ? (
        <Badge
          variant="muted"
          className="h-5 border-0 px-1.5 text-[8.5px] font-normal"
        >
          {badge}
        </Badge>
      ) : null}
    </div>
  );
}

export function Features({ content }: { content: FeaturesContent }) {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className="section-shell scroll-mt-20"
    >
      <div className="site-container">
        <Reveal>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <SectionHeading
              eyebrow={content.eyebrow}
              title={<span id="features-heading">{content.title}</span>}
              description={content.description}
            />
            <SectionLink
              href={content.linkHref}
              className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1.5 text-[13px] font-medium transition-colors"
            >
              {content.linkLabel}
              <Sparkles className="size-3.5" />
            </SectionLink>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-3 lg:grid-cols-3 lg:gap-4">
          <Reveal className="min-w-0 lg:col-span-2">
            <article className="border-border bg-card relative flex h-full flex-col overflow-hidden rounded-2xl border p-5 shadow-[0_1px_2px_rgb(15_23_42/0.03)] sm:p-6">
              <div
                aria-hidden="true"
                className="bg-primary/5 pointer-events-none absolute -top-24 -right-20 size-64 rounded-full blur-3xl"
              />
              <FeatureHeading
                icon={KanbanSquare}
                title="Application tracker"
                badge="Sample board"
              />
              <h3 className="mt-5 max-w-md text-[1.15rem] font-semibold tracking-[-0.02em]">
                Every application, one clear pipeline.
              </h3>
              <p className="text-muted-foreground mt-2 max-w-lg text-[13px] leading-6">
                Move from interested to accepted across nine stages. Switch
                between Kanban and calendar views, add private notes, and see
                exactly what is waiting on you.
              </p>

              <div className="border-border/80 bg-muted/25 mt-5 grid scrollbar-none auto-cols-[minmax(9.5rem,1fr)] grid-flow-col gap-2 overflow-x-auto rounded-xl border p-2.5 sm:auto-cols-auto sm:grid-flow-row sm:grid-cols-3 sm:overflow-visible">
                {kanbanColumns.map((column) => (
                  <div
                    key={column.title}
                    className="border-border/80 bg-card/80 rounded-lg border p-2"
                  >
                    <div className="flex items-center justify-between px-0.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`size-1.5 rounded-full ${column.dot}`}
                          aria-hidden="true"
                        />
                        <span className="text-[9px] font-medium">
                          {column.title}
                        </span>
                      </div>
                      <span className="text-muted-foreground text-[8.5px]">
                        {column.items.length}
                      </span>
                    </div>
                    <div className="mt-1.5 space-y-1.5">
                      {column.items.map((item) => (
                        <div
                          key={item.name}
                          className="border-border/80 bg-card rounded-md border p-1.5 shadow-[0_1px_1px_rgb(15_23_42/0.02)]"
                        >
                          <p className="truncate text-[8.5px] font-medium">
                            {item.name}
                          </p>
                          <p className="text-muted-foreground mt-0.5 truncate text-[7.5px]">
                            {item.meta}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-border/70 text-muted-foreground mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 text-[10px]">
                <span className="inline-flex items-center gap-1">
                  <KanbanSquare className="size-3" aria-hidden="true" />
                  Kanban
                </span>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3" aria-hidden="true" />
                  Calendar
                </span>
                <span>9 stages · Private notes · Progress</span>
              </div>
            </article>
          </Reveal>

          <Reveal delay={0.06} className="min-w-0">
            <article className="border-border bg-card flex h-full flex-col rounded-2xl border p-5 shadow-[0_1px_2px_rgb(15_23_42/0.03)] sm:p-6">
              <FeatureHeading
                icon={Clock3}
                title="Deadline radar"
                badge="Sample"
              />
              <h3 className="mt-5 text-[1.15rem] font-semibold tracking-[-0.02em]">
                Deadlines that don&apos;t surprise you.
              </h3>
              <p className="text-muted-foreground mt-2 text-[13px] leading-6">
                See what is close, what needs attention, and what can wait.
              </p>

              <div className="mt-4 space-y-1.5">
                {deadlines.map((deadline) => (
                  <div
                    key={`${deadline.month}-${deadline.day}`}
                    className="border-border/80 bg-muted/20 flex items-center gap-2.5 rounded-lg border px-2 py-1.5"
                  >
                    <div className="w-8 shrink-0 text-center">
                      <p className="text-muted-foreground text-[7.5px] font-medium">
                        {deadline.month}
                      </p>
                      <p
                        className={`text-[13px] leading-none font-semibold ${deadline.tone}`}
                      >
                        {deadline.day}
                      </p>
                    </div>
                    <div className="border-border/80 min-w-0 flex-1 border-l pl-2.5">
                      <p className="truncate text-[9.5px] font-medium">
                        {deadline.title}
                      </p>
                      <p className="text-muted-foreground truncate text-[8px]">
                        {deadline.meta}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <p className="border-border/70 text-muted-foreground mt-auto border-t pt-3 text-[10px]">
                Reminders respect your notification preferences.
              </p>
            </article>
          </Reveal>

          <Reveal className="min-w-0">
            <article className="border-border bg-card flex h-full flex-col rounded-2xl border p-5 shadow-[0_1px_2px_rgb(15_23_42/0.03)] sm:p-6">
              <FeatureHeading
                icon={ShieldCheck}
                title="Source-linked records"
                badge="4 states"
              />
              <h3 className="mt-5 text-[1.15rem] font-semibold tracking-[-0.02em]">
                Verified records, not guesses.
              </h3>
              <p className="text-muted-foreground mt-2 text-[13px] leading-6">
                Important facts carry an official source, a review date, and a
                clear status.
              </p>

              <div className="border-border/80 bg-muted/25 mt-4 rounded-lg border p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-medium">
                    Tuition · 2027 intake
                  </span>
                  <Badge
                    variant="success"
                    className="h-4 px-1.5 text-[8px] font-normal"
                  >
                    <Check className="size-2" aria-hidden="true" />
                    Verified
                  </Badge>
                </div>
                <div className="text-muted-foreground mt-1.5 flex items-center gap-1 text-[8px]">
                  <Link2 className="size-2.5" aria-hidden="true" />
                  Official university page · review date attached
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1">
                {[
                  ["Verified", "bg-emerald-500"],
                  ["Needs review", "bg-amber-500"],
                  ["Unverified", "bg-slate-400"],
                  ["Expired", "bg-rose-500"],
                ].map(([label, dot]) => (
                  <span
                    key={label}
                    className="border-border/80 text-muted-foreground inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[8px]"
                  >
                    <span
                      className={`size-1 rounded-full ${dot}`}
                      aria-hidden="true"
                    />
                    {label}
                  </span>
                ))}
              </div>

              <p className="border-border/70 text-muted-foreground mt-auto border-t pt-3 text-[10px]">
                Anything uncertain is marked, never presented as fact.
              </p>
            </article>
          </Reveal>

          <Reveal delay={0.04} className="min-w-0">
            <article className="border-border bg-card flex h-full flex-col rounded-2xl border p-5 shadow-[0_1px_2px_rgb(15_23_42/0.03)] sm:p-6">
              <FeatureHeading
                icon={FileText}
                title="Document vault"
                badge="Private"
              />
              <h3 className="mt-5 text-[1.15rem] font-semibold tracking-[-0.02em]">
                Documents, private by default.
              </h3>
              <p className="text-muted-foreground mt-2 text-[13px] leading-6">
                Passport, transcripts, test scores, and statements — organized
                by category with completion tracking.
              </p>

              <div className="mt-4 space-y-1.5">
                {documents.map((document) => (
                  <div
                    key={document.name}
                    className="border-border/80 flex items-center gap-2 rounded-lg border px-2 py-1.5"
                  >
                    <span
                      className={
                        document.ready
                          ? "flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300"
                          : "flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300"
                      }
                    >
                      {document.ready ? (
                        <Check className="size-2.5" aria-hidden="true" />
                      ) : (
                        <CircleHelp className="size-2.5" aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[9.5px] font-medium">
                        {document.name}
                      </p>
                      <p className="text-muted-foreground text-[8px]">
                        {document.meta}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <p className="border-border/70 text-muted-foreground mt-auto flex items-center gap-1 border-t pt-3 text-[10px]">
                <LockKeyhole className="size-3" aria-hidden="true" />
                Owner-only access · validated uploads
              </p>
            </article>
          </Reveal>

          <Reveal delay={0.08} className="min-w-0">
            <article className="border-border bg-card flex h-full flex-col rounded-2xl border p-5 shadow-[0_1px_2px_rgb(15_23_42/0.03)] sm:p-6">
              <FeatureHeading
                icon={Award}
                title="Scholarship fit"
                badge="Sample"
              />
              <h3 className="mt-5 text-[1.15rem] font-semibold tracking-[-0.02em]">
                Funding fit, explained.
              </h3>
              <p className="text-muted-foreground mt-2 text-[13px] leading-6">
                See which criteria match your profile and which are still
                unknown — without false promises.
              </p>

              <div className="mt-4 space-y-1.5">
                {[
                  { label: "Nationality", state: "Match", match: true },
                  { label: "Degree level", state: "Match", match: true },
                  { label: "English score", state: "Unknown", match: false },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="border-border/80 flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-[9px]"
                  >
                    <span className="text-muted-foreground">{item.label}</span>
                    <span
                      className={
                        item.match
                          ? "inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400"
                          : "inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400"
                      }
                    >
                      {item.match ? (
                        <Check className="size-2.5" aria-hidden="true" />
                      ) : (
                        <CircleHelp className="size-2.5" aria-hidden="true" />
                      )}
                      {item.state}
                    </span>
                  </div>
                ))}
              </div>

              <p className="border-border/70 text-muted-foreground mt-auto border-t pt-3 text-[10px]">
                Matches are informational. Funding is never guaranteed.
              </p>
            </article>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
