import Link from "next/link";
import { CheckCircle2, ShieldCheck } from "lucide-react";

import { Logo, LogoMark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { cn } from "@/lib/utils";

const benefits = [
  "Source-linked university and scholarship records.",
  "One calm workspace for shortlists, deadlines, and documents.",
  "Guardian consent and privacy built in for students under 18.",
] as const;

export function AuthShell({
  title,
  description,
  children,
  footer,
  wide = false,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="bg-background relative min-h-dvh overflow-hidden">
      <div
        aria-hidden="true"
        className="hero-grid pointer-events-none absolute inset-0 opacity-40"
      />

      <div className="relative grid min-h-dvh lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <aside className="relative hidden overflow-hidden bg-slate-950 lg:flex">
          <div
            aria-hidden="true"
            className="absolute -top-28 -left-24 size-96 rounded-full bg-indigo-500/25 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="absolute right-0 bottom-0 size-80 rounded-full bg-cyan-400/10 blur-3xl"
          />
          <div className="relative flex w-full max-w-lg flex-col justify-between gap-12 p-10 xl:p-14">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 backdrop-blur">
                <LogoMark className="size-8" />
              </span>
              <span className="text-[17px] font-semibold tracking-[-0.02em] text-white">
                Edu<span className="text-indigo-300">Bridge</span>
              </span>
            </div>

            <div>
              <p className="font-mono text-[11px] font-medium tracking-[0.18em] text-indigo-300 uppercase">
                Your bridge to global education
              </p>
              <h2 className="mt-5 max-w-md text-4xl leading-[1.08] font-semibold tracking-[-0.04em] text-white xl:text-[42px]">
                Every application,
                <br />
                one clear path.
              </h2>
              <p className="mt-4 max-w-sm text-[14px] leading-6 text-slate-300">
                Research, shortlist, and track international opportunities with
                source-linked data and a calmer workflow.
              </p>

              <ul className="mt-9 space-y-4">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex gap-3">
                    <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-indigo-400/15 ring-1 ring-indigo-300/25">
                      <CheckCircle2
                        aria-hidden="true"
                        className="size-3.5 text-indigo-300"
                      />
                    </span>
                    <span className="text-[13px] leading-6 text-slate-300">
                      {benefit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                <ShieldCheck
                  aria-hidden="true"
                  className="size-4 text-emerald-300"
                />
                Privacy by design
              </div>
              <p className="mt-1.5 text-[12.5px] leading-5 text-slate-300">
                Hashed sessions, same-origin checks, and age-appropriate consent
                are built into every workspace.
              </p>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="flex items-center justify-between gap-3 px-5 py-5 sm:px-8">
            <Logo className="lg:hidden" />
            <div className="ml-auto flex items-center gap-1">
              <Link
                href="/"
                className="text-muted-foreground hover:text-foreground rounded-md px-3 py-2 text-[13px] font-medium transition-colors"
              >
                Back to site
              </Link>
              <ThemeToggle />
            </div>
          </header>

          <main className="flex flex-1 items-center justify-center px-4 pt-2 pb-10 sm:px-8">
            <div className={cn("w-full", wide ? "max-w-2xl" : "max-w-md")}>
              <div className="surface-card p-6 sm:p-8">
                <div className="mb-7">
                  <span className="bg-brand-soft text-brand-strong mb-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium">
                    <ShieldCheck aria-hidden="true" className="size-3.5" />
                    Secure access
                  </span>
                  <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.03em] sm:text-[30px]">
                    {title}
                  </h1>
                  <p className="text-muted-foreground mt-2 text-sm leading-6">
                    {description}
                  </p>
                </div>

                {children}

                {footer ? (
                  <div className="border-border mt-8 border-t pt-6">
                    {footer}
                  </div>
                ) : null}
              </div>

              <p className="text-muted-foreground mt-5 text-center text-[12px] leading-5">
                Hashed sessions, same-origin checks, and sign-in throttling
                protect your account.
              </p>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
