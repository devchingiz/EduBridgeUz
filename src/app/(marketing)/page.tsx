import type { Metadata } from "next";
import { connection } from "next/server";

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
import { getPublishedHomepageContent } from "@/lib/cms/homepage";
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

export default async function HomePage() {
  // The CMS read is request-time data; the cached loader is invalidated by the
  // admin save action. Stop prerendering before touching the database.
  await connection();
  const content = await getPublishedHomepageContent();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(websiteJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <Hero content={content.hero} />
      <UniversitySearch content={content.universitySearch} />
      <HowItWorks content={content.howItWorks} />
      <Features content={content.features} />
      <Scholarships content={content.scholarships} />
      <AiAdvisor content={content.advisor} />
      <Verification content={content.verification} />
      <Testimonials content={content.testimonials} />
      <Faq content={content.faq} />
      <FinalCta content={content.finalCta} />
    </>
  );
}
