import { Check, Quote } from "lucide-react";

import { Reveal } from "@/components/marketing/reveal";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Badge } from "@/components/ui/badge";

const commitments = [
  "Published only with explicit permission",
  "Context included, including country and degree",
  "No promised outcomes or edited results",
];

export function Testimonials() {
  return (
    <section
      aria-labelledby="testimonials-heading"
      className="section-shell border-border/60 bg-muted/25 border-y"
    >
      <div className="site-container">
        <Reveal>
          <SectionHeading
            eyebrow="Student stories"
            title={
              <span id="testimonials-heading">
                Real experiences, only when they&apos;re real.
              </span>
            }
            description="We are not publishing invented testimonials to make the product look finished. This space is reserved for students who choose to share their story after launch."
          />
        </Reveal>

        <div className="mt-9 grid gap-3 lg:grid-cols-[1.45fr_0.55fr]">
          <Reveal>
            <figure className="border-border bg-card relative h-full overflow-hidden rounded-2xl border p-6 sm:p-8">
              <Quote className="text-primary/20 size-8" aria-hidden="true" />
              <blockquote className="text-foreground/90 mt-4 max-w-2xl text-[17px] leading-8 font-medium tracking-[-0.015em] sm:text-lg">
                &ldquo;We don&apos;t publish testimonials we can&apos;t verify.
                When students share their stories here, you&apos;ll see them
                with permission and context — not as marketing copy.&rdquo;
              </blockquote>
              <figcaption className="border-border/70 mt-5 flex flex-wrap items-center gap-2 border-t pt-4">
                <Badge variant="warning" className="gap-1.5">
                  <span className="size-1.5 rounded-full bg-amber-500" />
                  Development placeholder
                </Badge>
                <span className="text-muted-foreground text-[11px]">
                  No student testimonial has been published.
                </span>
              </figcaption>
            </figure>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="border-border bg-card h-full rounded-2xl border p-6">
              <p className="text-muted-foreground font-mono text-[9.5px] font-medium tracking-[0.14em] uppercase">
                Our commitment
              </p>
              <ul className="mt-4 space-y-3">
                {commitments.map((commitment) => (
                  <li
                    key={commitment}
                    className="text-foreground/80 flex items-start gap-2.5 text-[12px] leading-5"
                  >
                    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300">
                      <Check className="size-2.5" aria-hidden="true" />
                    </span>
                    {commitment}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
