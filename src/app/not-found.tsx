import { ArrowLeft, Compass } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="site-container flex h-16 items-center justify-between">
        <Logo />
        <ThemeToggle />
      </header>

      <main className="site-container flex flex-1 flex-col items-center justify-center py-20 text-center">
        <p className="text-primary font-mono text-[11px] font-medium tracking-[0.22em] uppercase">
          404
        </p>
        <h1 className="mt-4 max-w-xl text-3xl font-semibold tracking-[-0.035em] text-balance sm:text-4xl">
          This bridge doesn&apos;t lead anywhere yet.
        </h1>
        <p className="text-muted-foreground mt-3 max-w-md text-sm leading-6">
          The page may have moved, or it may be part of a milestone that has not
          shipped. You can head home or explore the preview on the landing page.
        </p>
        <div className="mt-7 flex flex-col gap-2 sm:flex-row">
          <Button asChild>
            <Link href="/">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back home
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/#universities">
              <Compass className="size-4" aria-hidden="true" />
              Explore universities
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
