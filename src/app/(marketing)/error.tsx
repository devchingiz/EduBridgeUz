"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function MarketingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="site-container flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
      <p className="eyebrow">Something went wrong</p>
      <h1 className="mt-3 max-w-lg text-3xl font-semibold tracking-[-0.035em] text-balance sm:text-4xl">
        We couldn&apos;t load this page.
      </h1>
      <p className="text-muted-foreground mt-3 max-w-md text-sm leading-6">
        This is on us. Try again, or return to the landing page while we look
        into it.
      </p>
      {error.digest ? (
        <p className="text-muted-foreground mt-3 font-mono text-[10px]">
          Reference: {error.digest}
        </p>
      ) : null}
      <div className="mt-7 flex flex-col gap-2 sm:flex-row">
        <Button onClick={() => reset()}>
          <RotateCcw className="size-4" aria-hidden="true" />
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Back home</Link>
        </Button>
      </div>
    </div>
  );
}
