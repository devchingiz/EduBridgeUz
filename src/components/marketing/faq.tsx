import Link from "next/link";

import { Reveal } from "@/components/marketing/reveal";
import { SectionHeading } from "@/components/marketing/section-heading";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    value: "pricing",
    question: "Is EduBridge free to use?",
    answer: (
      <>
        Core student discovery and application tracking are planned to be free.
        We have not finalized pricing for future counselor or institution tools;
        if that changes, pricing will be published clearly before launch.
      </>
    ),
  },
  {
    value: "data",
    question: "Where does university and scholarship information come from?",
    answer: (
      <>
        Important records are intended to link to an official university,
        government, or scholarship-provider page. We record the source URL, the
        publishing organization, and the verification date. Information we
        cannot verify is labeled unverified or left out — never presented as
        fact. Read the{" "}
        <Link
          href="/data-sources"
          className="text-primary font-medium underline-offset-4 hover:underline"
        >
          data sources policy
        </Link>
        .
      </>
    ),
  },
  {
    value: "ai",
    question: "Can the AI advisor guarantee admission or a scholarship?",
    answer: (
      <>
        No. The advisor helps you understand requirements, compare options, and
        build an application plan. It does not make final decisions, predict
        outcomes, or replace official guidance. Always confirm details with the
        institution or scholarship provider.
      </>
    ),
  },
  {
    value: "documents",
    question: "How will my documents be protected?",
    answer: (
      <>
        Documents are designed to live in private storage with owner-only
        access. Uploads will be type- and size-validated, file URLs will not be
        publicly accessible, and uploaded files will never be executed. You will
        be able to delete your account and associated data when accounts open.
      </>
    ),
  },
  {
    value: "languages",
    question: "Which languages are supported?",
    answer: (
      <>
        English is the default interface today. Uzbek and Russian are planned
        before public launch. The platform is being structured with localization
        in mind rather than treating translation as an afterthought.
      </>
    ),
  },
  {
    value: "countries",
    question: "Which countries can I explore?",
    answer: (
      <>
        EduBridge is being built for international applicants worldwide, with an
        initial focus on students from Uzbekistan and Central Asia. We will
        publish the catalog by destination as records pass verification rather
        than promise coverage numbers before they are real.
      </>
    ),
  },
  {
    value: "privacy",
    question: "Do you sell personal data?",
    answer: (
      <>
        No. EduBridge is not an advertising business. We intend to collect only
        what the product needs, explain each category in the{" "}
        <Link
          href="/privacy"
          className="text-primary font-medium underline-offset-4 hover:underline"
        >
          privacy notice
        </Link>
        , and provide a deletion path. Accounts are not open yet, so this site
        currently collects no student records.
      </>
    ),
  },
];

export function Faq() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="section-shell scroll-mt-20"
    >
      <div className="site-container">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <Reveal>
            <div className="lg:sticky lg:top-24">
              <SectionHeading
                eyebrow="FAQ"
                title={
                  <span id="faq-heading">
                    Straight answers, before you ask.
                  </span>
                }
                description="If something is not clear, it is usually because the answer is still being built. These are the decisions we have made so far."
              />
              <Link
                href="/data-sources"
                className="text-primary mt-5 inline-flex text-[13px] font-medium underline-offset-4 hover:underline"
              >
                How we handle data sources
              </Link>
            </div>
          </Reveal>

          <Reveal delay={0.06}>
            <div className="border-border bg-card rounded-2xl border px-5 sm:px-6">
              <Accordion type="single" collapsible defaultValue="data">
                {faqs.map((faq) => (
                  <AccordionItem key={faq.value} value={faq.value}>
                    <AccordionTrigger>{faq.question}</AccordionTrigger>
                    <AccordionContent>{faq.answer}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
