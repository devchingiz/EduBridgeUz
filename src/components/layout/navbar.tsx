"use client";

import { ArrowUpRight, Menu } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Logo } from "@/components/brand/logo";
import { SectionLink } from "@/components/layout/section-link";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "bg-background/85 sticky top-0 z-40 w-full border-b backdrop-blur-xl transition-[border-color,box-shadow] duration-300",
        scrolled
          ? "border-border/80 shadow-[0_4px_24px_-20px_rgb(15_23_42/0.35)]"
          : "border-transparent",
      )}
    >
      <div className="site-container flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Logo />
          <nav aria-label="Main navigation" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {siteConfig.nav.map((item) => (
                <li key={item.href}>
                  <SectionLink
                    href={item.href}
                    className="text-muted-foreground hover:bg-muted/70 hover:text-foreground inline-flex h-9 items-center rounded-md px-3 text-[13.5px] font-medium transition-colors"
                  >
                    {item.label}
                  </SectionLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
          <Button
            asChild
            size="sm"
            variant="ghost"
            className="hidden sm:inline-flex"
          >
            <Link href="/login">Log In</Link>
          </Button>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/register">Sign Up</Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="hidden md:inline-flex"
          >
            <Link href="/dashboard">Explore Dashboard</Link>
          </Button>

          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetTitle className="sr-only">Navigation menu</SheetTitle>
              <SheetDescription className="sr-only">
                Explore EduBridge sections and settings.
              </SheetDescription>

              <div className="border-border flex items-center justify-between border-b pb-5">
                <Logo />
              </div>

              <nav aria-label="Mobile navigation" className="mt-2">
                <ul className="flex flex-col">
                  {siteConfig.nav.map((item) => (
                    <li key={item.href} className="border-border border-b">
                      <SheetClose asChild>
                        <SectionLink
                          href={item.href}
                          className="text-foreground flex items-center justify-between py-4 text-[15px] font-medium"
                        >
                          {item.label}
                          <ArrowUpRight className="text-muted-foreground size-4" />
                        </SectionLink>
                      </SheetClose>
                    </li>
                  ))}
                </ul>
              </nav>

              <div className="mt-6 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <SheetClose asChild>
                    <Button asChild className="w-full" variant="outline">
                      <Link href="/login">Log In</Link>
                    </Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button asChild className="w-full">
                      <Link href="/register">Sign Up</Link>
                    </Button>
                  </SheetClose>
                </div>
                <SheetClose asChild>
                  <Button
                    asChild
                    className="w-full"
                    size="lg"
                    variant="outline"
                  >
                    <Link href="/dashboard">
                      Explore Dashboard
                      <ArrowUpRight className="size-4" />
                    </Link>
                  </Button>
                </SheetClose>
                <SheetClose asChild>
                  <Button
                    asChild
                    variant="outline"
                    className="w-full"
                    size="lg"
                  >
                    <SectionLink href="/#scholarships">
                      Find scholarships
                    </SectionLink>
                  </Button>
                </SheetClose>
              </div>

              <div className="border-border mt-auto border-t pt-5">
                <div className="text-muted-foreground flex items-center justify-between text-xs">
                  <span>Theme</span>
                  <ThemeToggle />
                </div>
                <p className="text-muted-foreground mt-3 text-xs leading-5">
                  Built for students in Uzbekistan, Central Asia, and around the
                  world.
                </p>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
