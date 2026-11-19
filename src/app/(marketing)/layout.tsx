import { Footer } from "@/components/layout/footer";
import { HashScroll } from "@/components/layout/hash-scroll";
import { Navbar } from "@/components/layout/navbar";
import { SectionLink } from "@/components/layout/section-link";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div id="top" className="flex min-h-dvh flex-col">
      <HashScroll />
      <SectionLink
        href="#main"
        className="bg-primary text-primary-foreground sr-only z-50 rounded-md px-4 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
      >
        Skip to content
      </SectionLink>
      <Navbar />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
