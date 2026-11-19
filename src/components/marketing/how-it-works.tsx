import {
  ClipboardCheck,
  SearchCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { Reveal } from "@/components/marketing/reveal";
import { SectionHeading } from "@/components/marketing/section-heading";

const steps: {
  icon: LucideIcon;
  title: string;
  description: string;
  meta: string;
}[] = [
  {
    icon: UserRound,
    title: "Build your profile",
    description:
      "Add your education, intended degree, budget, preferred countries, and any test scores. Better context leads to more relevant options — and your profile stays private.",
    meta: "Education · Scores · Budget · Goals",
  },
  {
    icon: SearchCheck,
    title: "Explore verified options",
    description:
      "Filter universities and scholarships by the things that matter. Important facts link to official sources and show when they were last verified.",
    meta: "Filters · Sources · Verification dates",
  },
  {
    icon: ClipboardCheck,
    title: "Apply with a plan",
    description:
      "Move each application through a clear pipeline, keep documents organized, watch deadlines, and turn requirements into an actionable checklist.",
    meta: "Kanban · Documents · Deadlines",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="section-shell border-border/60 bg-muted/25 scroll-mt-20 border-y"
    >
      <div className="site-container">
        <Reveal>
          <SectionHeading
            align="center"
            eyebrow="How it works"
            title={
              <span id="how-it-works-heading">
                From first search to final submission.
              </span>
            }
            description="A single, calm workflow for the parts of studying abroad that usually live in five different tabs."
          />
        </Reveal>

        <div className="relative mt-12">
          <div
            aria-hidden="true"
            className="border-border absolute top-[2.6rem] right-[16%] left-[16%] hidden border-t border-dashed lg:block"
          />
          <div className="grid gap-3 lg:grid-cols-3 lg:gap-5">
            {steps.map((step, index) => (
              <Reveal key={step.title} delay={index * 0.08}>
                <article className="border-border bg-card relative h-full rounded-2xl border p-5 shadow-[0_1px_2px_rgb(15_23_42/0.03)] sm:p-6">
                  <div className="flex items-center justify-between">
                    <span className="border-primary/10 bg-accent text-primary flex size-10 items-center justify-center rounded-xl border">
                      <step.icon className="size-[18px]" aria-hidden="true" />
                    </span>
                    <span className="text-muted-foreground font-mono text-[10px] font-medium tracking-[0.16em]">
                      STEP 0{index + 1}
                    </span>
                  </div>
                  <h3 className="mt-5 text-base font-semibold tracking-[-0.015em]">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground mt-2 text-[13.5px] leading-6">
                    {step.description}
                  </p>
                  <p className="border-border/70 text-muted-foreground mt-5 border-t pt-3 font-mono text-[9.5px] tracking-[0.08em] uppercase">
                    {step.meta}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
