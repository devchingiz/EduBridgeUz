import {
  BadgeCheck,
  CalendarClock,
  Check,
  FileText,
  FileWarning,
  Link2,
  UserCheck,
} from "lucide-react";

import { SectionLink } from "@/components/layout/section-link";
import { Reveal } from "@/components/marketing/reveal";
import { SectionHeading } from "@/components/marketing/section-heading";
import type { VerificationContent } from "@/lib/cms/homepage-content";

const statIcons = [BadgeCheck, CalendarClock, FileText, UserCheck] as const;
const principleIcons = [Link2, UserCheck, CalendarClock] as const;

const statuses = [
  {
    label: "Verified",
    className:
      "border-emerald-600/20 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300",
    dot: "bg-emerald-500",
    icon: Check,
  },
  {
    label: "Needs review",
    className:
      "border-amber-600/20 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300",
    dot: "bg-amber-500",
    icon: CalendarClock,
  },
  {
    label: "Unverified",
    className: "border-border bg-muted text-muted-foreground",
    dot: "bg-slate-400",
    icon: FileWarning,
  },
  {
    label: "Expired",
    className:
      "border-rose-600/20 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300",
    dot: "bg-rose-500",
    icon: FileWarning,
  },
] as const;

export function Verification({ content }: { content: VerificationContent }) {
  return (
    <section
      id="verification"
      aria-labelledby="verification-heading"
      className="section-shell scroll-mt-20"
    >
      <div className="site-container">
        <Reveal>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <SectionHeading
              eyebrow={content.eyebrow}
              title={<span id="verification-heading">{content.title}</span>}
              description={content.description}
            />
            <SectionLink
              href={content.linkHref}
              className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1.5 text-[13px] font-medium transition-colors"
            >
              {content.linkLabel}
              <Link2 className="size-3.5" />
            </SectionLink>
          </div>
        </Reveal>

        <div className="mt-9 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {content.stats.map((stat, index) => {
            const Icon = statIcons[index];
            return (
              <Reveal key={stat.label} delay={index * 0.04}>
                <div className="border-border bg-card h-full rounded-xl border p-4 sm:p-5">
                  <Icon className="text-primary/70 size-4" aria-hidden="true" />
                  <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                    {stat.value}
                  </p>
                  <p className="text-muted-foreground mt-1.5 text-[11.5px] leading-4.5">
                    {stat.label}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>
        <p className="text-muted-foreground mt-3 text-[10.5px]">
          {content.note}
        </p>

        <div className="mt-10 grid gap-3 md:grid-cols-3">
          {content.principles.map((principle, index) => {
            const Icon = principleIcons[index];
            return (
              <Reveal key={principle.title} delay={index * 0.06}>
                <article className="border-border bg-card h-full rounded-xl border p-5">
                  <span className="bg-accent text-primary flex size-8 items-center justify-center rounded-lg">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-[13.5px] font-semibold">
                    {principle.title}
                  </h3>
                  <p className="text-muted-foreground mt-1.5 text-[12px] leading-5">
                    {principle.description}
                  </p>
                </article>
              </Reveal>
            );
          })}
        </div>

        <div className="border-border bg-muted/30 mt-4 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-[11.5px]">
            {content.statusesNote}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {statuses.map((status) => (
              <span
                key={status.label}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium ${status.className}`}
              >
                <status.icon className="size-2.5" aria-hidden="true" />
                {status.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
