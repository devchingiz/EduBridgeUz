import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const benefits = [
  "Verified university and scholarship records, with sources.",
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
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <aside className="bg-muted/30 border-border relative hidden flex-col justify-between border-r p-10 lg:flex xl:p-14">
        <Logo />

        <div className="max-w-sm">
          <p className="eyebrow">Your bridge to global education</p>
          <h2 className="mt-4 text-3xl leading-tight font-semibold tracking-[-0.03em]">
            A clearer path from shortlist to offer letter.
          </h2>
          <ul className="mt-8 space-y-4">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex gap-3">
                <CheckCircle2
                  aria-hidden="true"
                  className="text-primary mt-0.5 size-4 shrink-0"
                />
                <span className="text-muted-foreground text-[13.5px] leading-6">
                  {benefit}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-muted-foreground max-w-sm text-xs leading-5">
          EduBridge is in active development. Always confirm requirements, fees,
          and deadlines with the official institution before applying.
        </p>
      </aside>

      <div className="flex min-w-0 flex-col">
        <div className="flex items-center justify-between p-5 sm:px-8">
          <Logo className="lg:hidden" />
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground text-[13px] font-medium transition-colors"
            >
              Back to site
            </Link>
            <ThemeToggle />
          </div>
        </div>

        <main className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8">
          <div className={wide ? "w-full max-w-2xl" : "w-full max-w-md"}>
            <h1 className="text-2xl font-semibold tracking-[-0.025em] sm:text-[28px]">
              {title}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm leading-6">
              {description}
            </p>

            <div className="mt-8">{children}</div>

            {footer ? (
              <div className="border-border mt-8 border-t pt-6">{footer}</div>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
