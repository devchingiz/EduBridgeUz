import { ArrowUpRight } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { SectionLink } from "@/components/layout/section-link";
import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/lib/site";

const columns = [
  { title: "Product", links: siteConfig.footer.product },
  { title: "Platform", links: siteConfig.footer.platform },
  { title: "Trust", links: siteConfig.footer.trust },
] as const;

export function Footer() {
  return (
    <footer className="border-border bg-muted/30 border-t">
      <div className="site-container py-14 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.35fr_repeat(3,1fr)] lg:gap-8">
          <div className="max-w-xs">
            <Logo />
            <p className="text-muted-foreground mt-4 text-sm leading-6">
              {siteConfig.tagline} Discover verified international universities,
              scholarships, and a calmer application process.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Pre-launch
              </Badge>
              <span className="text-muted-foreground text-[11px]">
                English preview
              </span>
            </div>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="text-muted-foreground font-mono text-[10px] font-medium tracking-[0.14em] uppercase">
                {column.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <SectionLink
                      href={link.href}
                      className="group text-foreground/70 hover:text-foreground inline-flex items-center gap-1 text-[13.5px] transition-colors"
                    >
                      {link.label}
                      <ArrowUpRight className="size-3 opacity-0 transition-opacity group-hover:opacity-60" />
                    </SectionLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-border mt-12 flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-xs">
            © {new Date().getFullYear()} EduBridge. All rights reserved.
          </p>
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span>English</span>
            <span aria-hidden="true" className="text-border">
              /
            </span>
            <span>O&apos;zbekcha — planned</span>
            <span aria-hidden="true" className="text-border">
              /
            </span>
            <span>Русский — planned</span>
          </div>
        </div>

        <p className="text-muted-foreground mt-4 max-w-3xl text-[11px] leading-5">
          EduBridge is in active development. University and scholarship data
          shown on this site is illustrative unless explicitly marked as
          verified. Always confirm requirements, fees, and deadlines with the
          official institution before applying.
        </p>
      </div>
    </footer>
  );
}
