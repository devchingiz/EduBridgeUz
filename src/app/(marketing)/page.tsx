import type { Metadata } from "next";

import { AiAdvisor } from "@/components/marketing/ai-advisor";
import { Faq } from "@/components/marketing/faq";
import { Features } from "@/components/marketing/features";
import { FinalCta } from "@/components/marketing/final-cta";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Scholarships } from "@/components/marketing/scholarships";
import { Testimonials } from "@/components/marketing/testimonials";
import { UniversitySearch } from "@/components/marketing/university-search";
import { Verification } from "@/components/marketing/verification";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  description: siteConfig.description,
  alternates: {
    canonical: "/",
  },
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: siteConfig.name,
  url: siteConfig.url,
  description: siteConfig.description,
  inLanguage: "en",
  publisher: {
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.url,
  },
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(websiteJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <Hero />
      <UniversitySearch />
      <HowItWorks />
      <Features />
      <Scholarships />
      <AiAdvisor />
      <Verification />
      <Testimonials />
      <Faq />
      <FinalCta />
    </>
  );
}
