import {
  ArrowRight,
  Award,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { SectionLink } from "@/components/layout/section-link";
import { ProductPreview } from "@/components/marketing/product-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { HeroContent } from "@/lib/cms/homepage-content";

const pillarIcons: readonly LucideIcon[] = [ShieldCheck, LockKeyhole, Sparkles];

export function Hero({ content }: { content: HeroContent }) {
  return (
    <section className="relative isolate overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute inset-x-0 top-0 h-[620px] bg-[radial-gradient(ellipse_75%_60%_at_50%_0%,rgba(79,70,229,0.11),transparent_70%)] dark:bg-[radial-gradient(ellipse_75%_60%_at_50%_0%,rgba(129,140,248,0.13),transparent_70%)]" />
        <div className="hero-grid absolute inset-0 h-[560px] opacity-50" />
        <div className="absolute top-24 -right-24 size-72 rounded-full bg-sky-400/5 blur-3xl" />
      </div>

      <div className="site-container pt-12 pb-20 sm:pt-16 sm:pb-24 lg:pt-20 lg:pb-28">
        <div className="grid items-center gap-14 lg:grid-cols-[1.03fr_1fr] lg:gap-10 xl:gap-16">
          <div className="max-w-2xl">
            <Badge variant="brand" className="h-6 px-3 text-[11px]">
              <Sparkles className="size-3" aria-hidden="true" />
              {content.eyebrow}
            </Badge>

            <h1 className="mt-5 text-[2.6rem] leading-[1.01] font-semibold tracking-[-0.045em] text-balance sm:text-[3.35rem] lg:text-[3.65rem] xl:text-[4.15rem]">
              {content.titleLead}{" "}
              <span className="text-gradient">{content.titleAccent}</span>
            </h1>

            <p className="text-muted-foreground mt-6 max-w-xl text-[15.5px] leading-7 sm:text-[17px] sm:leading-8">
              {content.description}
            </p>

            <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
              <Button asChild size="lg">
                <SectionLink href={content.primaryCta.href}>
                  {content.primaryCta.label}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </SectionLink>
              </Button>
              <Button asChild size="lg" variant="outline">
                <SectionLink href={content.secondaryCta.href}>
                  <Award className="size-4" aria-hidden="true" />
                  {content.secondaryCta.label}
                </SectionLink>
              </Button>
            </div>

            <ul className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2.5">
              {content.pillars.map((pillar, index) => {
                const Icon = pillarIcons[index];
                return (
                  <li
                    key={pillar}
                    className="text-muted-foreground inline-flex items-center gap-1.5 text-[11.5px]"
                  >
                    <Icon
                      className="text-primary/80 size-3.5"
                      aria-hidden="true"
                    />
                    {pillar}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="relative lg:pl-2">
            <ProductPreview />
          </div>
        </div>
      </div>
    </section>
  );
}
