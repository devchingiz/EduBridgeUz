import { ArrowRight, Award, Sparkles } from "lucide-react";
import Link from "next/link";

import { SectionLink } from "@/components/layout/section-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function FinalCta() {
  return (
    <section aria-labelledby="cta-heading" className="pb-20 sm:pb-28">
      <div className="site-container">
        <div className="relative isolate overflow-hidden rounded-3xl bg-slate-950 px-6 py-12 sm:px-10 sm:py-16 lg:px-14">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_65%_80%_at_20%_0%,rgba(99,102,241,0.35),transparent_65%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_45%_60%_at_90%_100%,rgba(14,165,233,0.18),transparent_65%)]" />
            <svg
              viewBox="0 0 420 320"
              fill="none"
              className="absolute -right-16 bottom-0 h-[115%] w-auto text-white/[0.07]"
            >
              <path
                d="M40 280V168C40 98 96 42 166 42H254C324 42 380 98 380 168V280"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path d="M0 280H420" stroke="currentColor" strokeWidth="2" />
              <path
                d="M130 280V168M210 280V42M290 280V168"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M40 250H380M40 220H380"
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="4 8"
              />
            </svg>
          </div>

          <div className="max-w-2xl">
            <Badge className="border border-white/15 bg-white/10 text-white/85">
              <Sparkles className="size-3" aria-hidden="true" />
              Pre-launch · built in public
            </Badge>
            <h2
              id="cta-heading"
              className="mt-5 text-[2rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance text-white sm:text-4xl lg:text-[2.9rem]"
            >
              Build your bridge to the right university.
            </h2>
            <p className="mt-4 max-w-xl text-[14px] leading-6 text-slate-300 sm:text-[15px] sm:leading-7">
              Start with better information: source-linked universities,
              scholarships you can actually investigate, and one calm workspace
              for the application ahead.
            </p>
            <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
              <Button asChild size="lg" variant="inverse">
                <Link href="/register">
                  Get Started
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <SectionLink href="#scholarships">
                  <Award className="size-4" aria-hidden="true" />
                  Find Scholarships
                </SectionLink>
              </Button>
            </div>
            <p className="mt-5 text-[11px] text-slate-400">
              No invented outcomes. No guaranteed admissions. Just better
              information.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
