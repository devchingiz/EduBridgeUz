import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";

export function LegalPage({
  title,
  description,
  updated,
  children,
}: {
  title: string;
  description: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="section-shell">
      <div className="site-container">
        <div className="mx-auto max-w-3xl">
          <Badge variant="warning" className="gap-1.5">
            <span className="size-1.5 rounded-full bg-amber-500" />
            Pre-launch document
          </Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-balance sm:text-4xl">
            {title}
          </h1>
          <p className="text-muted-foreground mt-3 max-w-2xl text-[15px] leading-7">
            {description}
          </p>
          <p className="text-muted-foreground mt-3 font-mono text-[10px] tracking-[0.1em] uppercase">
            Last updated {updated}
          </p>

          <div className="border-border mt-8 space-y-8 border-t pt-8">
            {children}
          </div>

          <div className="border-border bg-muted/30 text-muted-foreground mt-10 rounded-xl border p-4 text-[11.5px] leading-5">
            This document describes a product in development. It will be
            reviewed and expanded before accounts, uploads, or AI features are
            made available to the public.
          </div>
        </div>
      </div>
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-base font-semibold tracking-[-0.015em]">{title}</h2>
      <div className="text-muted-foreground mt-2.5 space-y-3 text-[13.5px] leading-7">
        {children}
      </div>
    </section>
  );
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="marker:text-muted-foreground/50 list-disc space-y-1.5 pl-5">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}
