import {
  ArrowUp,
  Check,
  CircleHelp,
  ClipboardCheck,
  Info,
  Link2,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";

import { LogoMark } from "@/components/brand/logo";
import { Reveal } from "@/components/marketing/reveal";
import { Badge } from "@/components/ui/badge";

const capabilities = [
  {
    icon: UserRound,
    title: "Built from your profile",
    description:
      "Uses your education, scores, budget, destinations, and intended degree.",
  },
  {
    icon: CircleHelp,
    title: "Uncertainty is stated",
    description:
      "Separates verified facts, general guidance, and what still needs checking.",
  },
  {
    icon: Link2,
    title: "Sources stay attached",
    description:
      "Points back to official university and scholarship pages whenever available.",
  },
  {
    icon: ClipboardCheck,
    title: "Checklists, not decisions",
    description:
      "Turns requirements into next steps. It does not make admission decisions.",
  },
];

export function AiAdvisor() {
  return (
    <section
      id="advisor"
      aria-labelledby="advisor-heading"
      className="relative scroll-mt-20 overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute inset-x-0 top-0 h-full bg-[radial-gradient(ellipse_60%_70%_at_80%_30%,rgba(79,70,229,0.08),transparent_70%)] dark:bg-[radial-gradient(ellipse_60%_70%_at_80%_30%,rgba(129,140,248,0.1),transparent_70%)]" />
      </div>

      <div className="site-container section-shell">
        <div className="grid items-center gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16">
          <Reveal>
            <div>
              <Badge variant="brand" className="h-6 px-2.5 text-[10.5px]">
                <Sparkles className="size-3" aria-hidden="true" />
                AI University Advisor
              </Badge>
              <h2
                id="advisor-heading"
                className="mt-4 text-[1.85rem] leading-[1.08] font-semibold tracking-[-0.035em] text-balance sm:text-4xl lg:text-[2.7rem]"
              >
                Ask better questions.
                <br />
                Get source-aware answers.
              </h2>
              <p className="text-muted-foreground mt-4 max-w-xl text-[15px] leading-7">
                Your advisor understands your academic profile, explains
                admission requirements, finds gaps in your documents, and helps
                you organize a plan — with the limits of its knowledge made
                explicit.
              </p>

              <ul className="mt-7 space-y-4">
                {capabilities.map((capability) => (
                  <li key={capability.title} className="flex gap-3">
                    <span className="border-primary/10 bg-accent text-primary mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border">
                      <capability.icon className="size-4" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-[13px] font-medium">
                        {capability.title}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-[12px] leading-5">
                        {capability.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="border-border bg-card mt-7 flex items-start gap-2.5 rounded-xl border p-3.5">
                <Info
                  className="text-muted-foreground mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <p className="text-muted-foreground text-[11px] leading-5">
                  <span className="text-foreground font-medium">
                    AI can make mistakes.
                  </span>{" "}
                  EduBridge never guarantees admission or funding, and does not
                  make final admissions decisions. Always confirm details with
                  the official institution.
                </p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="relative">
              <div
                aria-hidden="true"
                className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-indigo-500/12 via-sky-400/6 to-transparent blur-2xl"
              />
              <div className="border-border/80 bg-card overflow-hidden rounded-2xl border shadow-[0_24px_80px_-42px_rgb(49_46_129/0.5)]">
                <div className="border-border bg-muted/30 flex items-center justify-between gap-3 border-b px-3.5 py-3">
                  <div className="flex items-center gap-2.5">
                    <LogoMark className="size-8" />
                    <div>
                      <p className="text-[12px] font-semibold">
                        EduBridge Advisor
                      </p>
                      <p className="flex items-center gap-1 text-[8.5px] text-emerald-600 dark:text-emerald-400">
                        <span className="size-1 rounded-full bg-emerald-500" />
                        Profile-aware · preview
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="h-5 px-1.5 text-[8.5px] font-normal"
                  >
                    Illustrative
                  </Badge>
                </div>

                <div className="space-y-4 p-3.5 sm:p-4">
                  <div className="bg-primary text-primary-foreground ml-auto max-w-[90%] rounded-2xl rounded-br-sm px-3.5 py-2.5 text-[10.5px] leading-4.5">
                    I have IELTS 7.0, SAT 1350, and GPA 3.7. I want to study
                    Computer Science in South Korea with a full scholarship.
                  </div>

                  <div className="flex gap-2.5">
                    <LogoMark className="mt-0.5 size-6 rounded-md" />
                    <div className="min-w-0 flex-1 space-y-2.5">
                      <p className="text-foreground/90 text-[10.5px] leading-4.5">
                        Here is how I would approach that. I can help you
                        research options — I cannot promise an outcome.
                      </p>

                      <div className="border-border/80 bg-muted/30 rounded-lg border p-2.5">
                        <p className="text-muted-foreground font-mono text-[8px] font-medium tracking-[0.1em] uppercase">
                          Profile understood
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {[
                            "IELTS 7.0",
                            "SAT 1350",
                            "GPA 3.7",
                            "CS · South Korea",
                          ].map((chip) => (
                            <span
                              key={chip}
                              className="bg-card text-foreground/80 ring-border/70 inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[8px] font-medium ring-1"
                            >
                              <Check
                                className="size-2 text-emerald-500"
                                aria-hidden="true"
                              />
                              {chip}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-[9.5px] font-semibold">
                          Worth researching
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-[9.5px] leading-4">
                          English-taught Computer Science programs in South
                          Korea and funding open to international students. I
                          will not rank them until current requirements are
                          confirmed from official pages.
                        </p>
                      </div>

                      <div className="rounded-lg border border-amber-500/20 bg-amber-50/60 p-2.5 dark:border-amber-400/15 dark:bg-amber-400/5">
                        <p className="flex items-center gap-1 text-[9.5px] font-semibold text-amber-700 dark:text-amber-300">
                          <CircleHelp className="size-2.5" aria-hidden="true" />
                          What I cannot confirm yet
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-[9px] leading-4">
                          Your nationality-specific eligibility, the next
                          deadline, and whether housing is covered. Each answer
                          will carry the official source.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {[
                          "Official university pages",
                          "Scholarship provider rules",
                        ].map((source) => (
                          <span
                            key={source}
                            className="border-border bg-card text-muted-foreground inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[7.5px]"
                          >
                            <Link2
                              className="text-primary size-2"
                              aria-hidden="true"
                            />
                            {source}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-border bg-muted/20 border-t p-3">
                  <div className="flex flex-wrap gap-1">
                    {[
                      "Compare two programs",
                      "What documents am I missing?",
                      "Closest deadlines",
                    ].map((prompt) => (
                      <span
                        key={prompt}
                        className="border-border bg-card text-muted-foreground rounded-full border px-2 py-0.5 text-[8px]"
                      >
                        {prompt}
                      </span>
                    ))}
                  </div>

                  <div className="border-border bg-card mt-2 flex items-center gap-2 rounded-lg border px-2.5 py-2">
                    <LockKeyhole
                      className="text-muted-foreground size-3 shrink-0"
                      aria-hidden="true"
                    />
                    <p className="text-muted-foreground text-[9px]">
                      Advisor opens with your account at launch
                    </p>
                    <span
                      aria-hidden="true"
                      className="bg-primary/15 text-primary ml-auto flex size-5 items-center justify-center rounded-md"
                    >
                      <ArrowUp className="size-2.5" />
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1.5 flex items-center justify-center gap-1 text-[7.5px]">
                    <ShieldCheck className="size-2.5" aria-hidden="true" />
                    Illustrative conversation · no real profile used
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
