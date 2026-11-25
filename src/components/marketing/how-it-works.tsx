import {
  ClipboardCheck,
  SearchCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { Reveal } from "@/components/marketing/reveal";
import { SectionHeading } from "@/components/marketing/section-heading";
import type { HowItWorksContent } from "@/lib/cms/homepage-content";

const stepIcons: readonly LucideIcon[] = [
  UserRound,
  SearchCheck,
  ClipboardCheck,
];

export function HowItWorks({ content }: { content: HowItWorksContent }) {
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
            eyebrow={content.eyebrow}
            title={<span id="how-it-works-heading">{content.title}</span>}
            description={content.description}
          />
        </Reveal>

        <div className="relative mt-12">
          <div
            aria-hidden="true"
            className="border-border absolute top-[2.6rem] right-[16%] left-[16%] hidden border-t border-dashed lg:block"
          />
          <div className="grid gap-3 lg:grid-cols-3 lg:gap-5">
            {content.steps.map((step, index) => {
              const Icon = stepIcons[index];
              return (
                <Reveal key={step.title} delay={index * 0.08}>
                  <article className="border-border bg-card relative h-full rounded-2xl border p-5 shadow-[0_1px_2px_rgb(15_23_42/0.03)] sm:p-6">
                    <div className="flex items-center justify-between">
                      <span className="border-primary/10 bg-accent text-primary flex size-10 items-center justify-center rounded-xl border">
                        <Icon className="size-[18px]" aria-hidden="true" />
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
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
