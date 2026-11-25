import { SectionLink } from "@/components/layout/section-link";
import { Reveal } from "@/components/marketing/reveal";
import { SectionHeading } from "@/components/marketing/section-heading";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { FaqContent } from "@/lib/cms/homepage-content";

export function Faq({ content }: { content: FaqContent }) {
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
                eyebrow={content.eyebrow}
                title={<span id="faq-heading">{content.title}</span>}
                description={content.description}
              />
              <SectionLink
                href={content.linkHref}
                className="text-primary mt-5 inline-flex text-[13px] font-medium underline-offset-4 hover:underline"
              >
                {content.linkLabel}
              </SectionLink>
            </div>
          </Reveal>

          <Reveal delay={0.06}>
            <div className="border-border bg-card rounded-2xl border px-5 sm:px-6">
              <Accordion
                type="single"
                collapsible
                defaultValue={content.defaultOpen}
              >
                {content.items.map((item) => (
                  <AccordionItem key={item.id} value={item.id}>
                    <AccordionTrigger>{item.question}</AccordionTrigger>
                    <AccordionContent>
                      <span>{item.answer}</span>
                      {item.link ? (
                        <>
                          {" "}
                          <SectionLink
                            href={item.link.href}
                            className="text-primary font-medium underline-offset-4 hover:underline"
                          >
                            {item.link.label}
                          </SectionLink>
                          .
                        </>
                      ) : null}
                    </AccordionContent>
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
