import { Award, Check, CircleHelp, Clock3, Info, Sparkles } from "lucide-react";

import { Reveal } from "@/components/marketing/reveal";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const benefits = [
  "Fully funded and partial awards in one search",
  "Nationality, degree, and field eligibility",
  "Deadline reminders before it is too late",
  "Save, shortlist, and add to your tracker",
];

const criteria = [
  {
    label: "Eligible nationality",
    value: "Uzbekistan listed",
    state: "Match",
    tone: "match",
  },
  {
    label: "Degree level",
    value: "Master's",
    state: "Match",
    tone: "match",
  },
  {
    label: "Study field",
    value: "Computer Science",
    state: "Match",
    tone: "match",
  },
  {
    label: "English language",
    value: "Score not provided",
    state: "Unknown",
    tone: "unknown",
  },
  {
    label: "Application deadline",
    value: "Not announced yet",
    state: "Unknown",
    tone: "unknown",
  },
] as const;

const filterChips = [
  "Fully funded",
  "Partial funding",
  "Bachelor's",
  "Master's",
  "PhD",
  "No IELTS required",
  "Deadline this month",
];

export function Scholarships() {
  return (
    <section
      id="scholarships"
      aria-labelledby="scholarships-heading"
      className="section-shell border-border/60 bg-muted/25 scroll-mt-20 border-y"
    >
      <div className="site-container">
        <div className="grid items-center gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16">
          <Reveal>
            <div>
              <SectionHeading
                eyebrow="Scholarship discovery"
                title={
                  <span id="scholarships-heading">
                    Funding shouldn&apos;t be a guessing game.
                  </span>
                }
                description="Search scholarships by funding level, nationality eligibility, degree, field, and deadline. See exactly which criteria match your profile — and which ones remain unknown."
              />

              <ul className="mt-7 grid gap-3 sm:grid-cols-2">
                {benefits.map((benefit) => (
                  <li
                    key={benefit}
                    className="text-foreground/80 flex items-start gap-2.5 text-[13px] leading-5"
                  >
                    <span className="mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300">
                      <Check className="size-2.5" aria-hidden="true" />
                    </span>
                    {benefit}
                  </li>
                ))}
              </ul>

              <div className="mt-7">
                <p className="text-muted-foreground font-mono text-[9.5px] font-medium tracking-[0.14em] uppercase">
                  Filters at launch
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {filterChips.map((chip) => (
                    <span
                      key={chip}
                      className="border-border bg-card text-muted-foreground inline-flex h-6 items-center rounded-full border px-2.5 text-[10.5px]"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Button asChild variant="outline" size="sm">
                  <a href="#advisor">
                    <Sparkles className="size-3.5" />
                    Ask the advisor
                  </a>
                </Button>
                <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[11px]">
                  <Clock3 className="size-3" aria-hidden="true" />
                  Live catalog opens with verified records
                </span>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="relative">
              <div
                aria-hidden="true"
                className="absolute -inset-3 -z-10 rounded-[1.75rem] bg-gradient-to-tr from-indigo-500/10 via-sky-400/5 to-transparent blur-xl"
              />
              <div className="surface-card overflow-hidden">
                <div className="border-border/70 bg-muted/30 flex items-start justify-between gap-3 border-b p-4">
                  <div className="flex items-center gap-2.5">
                    <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
                      <Award className="size-4" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-[13px] font-semibold">
                        Eligibility check
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-[10.5px]">
                        Sample profile · no real award attached
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="h-5 px-1.5 text-[8.5px] font-normal"
                  >
                    Preview
                  </Badge>
                </div>

                <div className="p-4">
                  <div className="flex flex-wrap gap-1.5">
                    {["Master's", "Computer Science", "Uzbekistan"].map(
                      (item) => (
                        <span
                          key={item}
                          className="bg-accent text-accent-foreground rounded-md px-2 py-1 text-[9.5px] font-medium"
                        >
                          {item}
                        </span>
                      ),
                    )}
                  </div>

                  <div className="divide-border/70 border-border/80 mt-3 divide-y rounded-lg border">
                    {criteria.map((criterion) => (
                      <div
                        key={criterion.label}
                        className="flex items-center justify-between gap-3 px-2.5 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-[9.5px] font-medium">
                            {criterion.label}
                          </p>
                          <p className="text-muted-foreground truncate text-[8.5px]">
                            {criterion.value}
                          </p>
                        </div>
                        <span
                          className={
                            criterion.tone === "match"
                              ? "inline-flex shrink-0 items-center gap-1 text-[8.5px] font-medium text-emerald-600 dark:text-emerald-400"
                              : "inline-flex shrink-0 items-center gap-1 text-[8.5px] font-medium text-amber-600 dark:text-amber-400"
                          }
                        >
                          {criterion.tone === "match" ? (
                            <Check className="size-2.5" aria-hidden="true" />
                          ) : (
                            <CircleHelp
                              className="size-2.5"
                              aria-hidden="true"
                            />
                          )}
                          {criterion.state}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="bg-muted/50 mt-3 flex items-center gap-2.5 rounded-lg px-2.5 py-2">
                    <div className="flex gap-0.5" aria-hidden="true">
                      {criteria.map((criterion) => (
                        <span
                          key={criterion.label}
                          className={
                            criterion.tone === "match"
                              ? "h-4 w-1.5 rounded-full bg-emerald-500"
                              : "h-4 w-1.5 rounded-full bg-amber-400/70"
                          }
                        />
                      ))}
                    </div>
                    <p className="text-muted-foreground text-[9px]">
                      <span className="text-foreground font-medium">
                        3 match
                      </span>{" "}
                      · 2 need review · not an eligibility decision
                    </p>
                  </div>

                  <div className="border-border/70 mt-3 flex items-start gap-2 border-t pt-3">
                    <Info
                      className="text-muted-foreground mt-0.5 size-3 shrink-0"
                      aria-hidden="true"
                    />
                    <p className="text-muted-foreground text-[8.5px] leading-4">
                      Eligibility depends on rules set by each provider.
                      EduBridge explains matches and unknowns; it never
                      guarantees funding.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
