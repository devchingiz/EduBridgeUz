import type { Metadata } from "next";
import Link from "next/link";
import {
  Clock3,
  Construction,
  NotebookPen,
  Search,
  Sparkles,
} from "lucide-react";

import { GateBanner } from "@/components/dashboard/gate-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getWorkspaceStatus, requireUser } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "AI Advisor",
  robots: { index: false, follow: false },
};

const comingSoon = [
  {
    title: "Answers from your workspace",
    description:
      "Grounded in your saved universities, applications, notes, and documents.",
  },
  {
    title: "Clearer shortlist estimates",
    description:
      "Reach, target, and likely guidance with the catalog data behind it.",
  },
  {
    title: "Practical next steps",
    description:
      "Checklists for deadlines, documents, scholarships, and programme fit.",
  },
] as const;

export default async function AdvisorPage() {
  const session = await requireUser();
  const workspaceStatus = await getWorkspaceStatus(session.user);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-muted-foreground text-[12px] font-medium tracking-wide uppercase">
            Student workspace
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-[-0.025em]">
            AI Advisor
            <Sparkles aria-hidden="true" className="text-primary size-5" />
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            A smarter, source-aware advisor is on the way.
          </p>
        </div>
        <Badge variant="warning" className="h-7 px-3">
          <Construction aria-hidden="true" />
          Upgrade in progress
        </Badge>
      </div>

      <GateBanner status={workspaceStatus} />

      <section
        aria-labelledby="advisor-upgrade-heading"
        className="border-border bg-card overflow-hidden rounded-2xl border shadow-[0_24px_80px_-48px_rgb(49_46_129/0.45)]"
      >
        <div className="border-border bg-muted/30 flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
          <span className="border-primary/10 bg-accent text-primary flex size-11 items-center justify-center rounded-xl border">
            <Construction aria-hidden="true" className="size-5" />
          </span>
          <Badge variant="outline">Coming soon</Badge>
        </div>

        <div className="p-5 sm:p-7">
          <h2
            id="advisor-upgrade-heading"
            className="text-xl font-semibold tracking-[-0.02em] sm:text-2xl"
          >
            We are rebuilding the AI Advisor
          </h2>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
            The advisor chat is temporarily hidden while we improve it. When it
            returns, it will give more useful guidance grounded in the same
            verified university catalog and your own workspace.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {comingSoon.map((item) => (
              <div
                key={item.title}
                className="border-border bg-muted/20 rounded-xl border p-4"
              >
                <p className="text-[13px] font-medium">{item.title}</p>
                <p className="text-muted-foreground mt-1 text-[12px] leading-5">
                  {item.description}
                </p>
              </div>
            ))}
          </div>

          <div className="border-border bg-muted/30 mt-6 flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground flex items-start gap-2 text-[13px] leading-5">
              <Clock3 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>
                Your existing conversations and workspace data are safe. The
                chat will return with the upgrade.
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link href="/dashboard/universities">
                  <Search aria-hidden="true" />
                  Explore universities
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/dashboard/notes">
                  <NotebookPen aria-hidden="true" />
                  Study notes
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
