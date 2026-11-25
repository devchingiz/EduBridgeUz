import { describe, expect, it } from "vitest";

import {
  defaultHomepageContent,
  homepageContentFromFormData,
  homepageContentSchema,
  HOMEPAGE_HREFS,
  type HomepageContent,
} from "@/lib/cms/homepage-content";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Mirrors the flat control names rendered by HomepageEditorForm. */
function toFormData(values: HomepageContent): FormData {
  const form = new FormData();
  const set = (key: string, value: string) => form.set(key, value);

  set("hero.eyebrow", values.hero.eyebrow);
  set("hero.titleLead", values.hero.titleLead);
  set("hero.titleAccent", values.hero.titleAccent);
  set("hero.description", values.hero.description);
  set("hero.primaryCta.label", values.hero.primaryCta.label);
  set("hero.primaryCta.href", values.hero.primaryCta.href);
  set("hero.secondaryCta.label", values.hero.secondaryCta.label);
  set("hero.secondaryCta.href", values.hero.secondaryCta.href);
  set("hero.pillars", values.hero.pillars.join("\n"));

  set("universitySearch.eyebrow", values.universitySearch.eyebrow);
  set("universitySearch.title", values.universitySearch.title);
  set("universitySearch.description", values.universitySearch.description);
  set("universitySearch.linkLabel", values.universitySearch.linkLabel);
  set("universitySearch.linkHref", values.universitySearch.linkHref);

  set("howItWorks.eyebrow", values.howItWorks.eyebrow);
  set("howItWorks.title", values.howItWorks.title);
  set("howItWorks.description", values.howItWorks.description);
  values.howItWorks.steps.forEach((step, index) => {
    set(`howItWorks.steps.${index}.title`, step.title);
    set(`howItWorks.steps.${index}.description`, step.description);
    set(`howItWorks.steps.${index}.meta`, step.meta);
  });

  set("features.eyebrow", values.features.eyebrow);
  set("features.title", values.features.title);
  set("features.description", values.features.description);
  set("features.linkLabel", values.features.linkLabel);
  set("features.linkHref", values.features.linkHref);

  set("scholarships.eyebrow", values.scholarships.eyebrow);
  set("scholarships.title", values.scholarships.title);
  set("scholarships.description", values.scholarships.description);
  set("scholarships.benefits", values.scholarships.benefits.join("\n"));
  set("scholarships.filtersNote", values.scholarships.filtersNote);
  set("scholarships.filterChips", values.scholarships.filterChips.join("\n"));
  set("scholarships.ctaLabel", values.scholarships.ctaLabel);
  set("scholarships.ctaHref", values.scholarships.ctaHref);
  set("scholarships.liveNote", values.scholarships.liveNote);

  set("advisor.badge", values.advisor.badge);
  set("advisor.titleLine1", values.advisor.titleLine1);
  set("advisor.titleLine2", values.advisor.titleLine2);
  set("advisor.description", values.advisor.description);
  values.advisor.capabilities.forEach((capability, index) => {
    set(`advisor.capabilities.${index}.title`, capability.title);
    set(`advisor.capabilities.${index}.description`, capability.description);
  });
  set("advisor.disclaimerLead", values.advisor.disclaimerLead);
  set("advisor.disclaimerBody", values.advisor.disclaimerBody);

  set("verification.eyebrow", values.verification.eyebrow);
  set("verification.title", values.verification.title);
  set("verification.description", values.verification.description);
  set("verification.linkLabel", values.verification.linkLabel);
  set("verification.linkHref", values.verification.linkHref);
  values.verification.stats.forEach((stat, index) => {
    set(`verification.stats.${index}.value`, stat.value);
    set(`verification.stats.${index}.label`, stat.label);
  });
  set("verification.note", values.verification.note);
  values.verification.principles.forEach((principle, index) => {
    set(`verification.principles.${index}.title`, principle.title);
    set(`verification.principles.${index}.description`, principle.description);
  });
  set("verification.statusesNote", values.verification.statusesNote);

  set("testimonials.eyebrow", values.testimonials.eyebrow);
  set("testimonials.title", values.testimonials.title);
  set("testimonials.description", values.testimonials.description);
  set("testimonials.quote", values.testimonials.quote);
  set("testimonials.placeholderLabel", values.testimonials.placeholderLabel);
  set("testimonials.placeholderNote", values.testimonials.placeholderNote);
  set("testimonials.commitmentLabel", values.testimonials.commitmentLabel);
  set("testimonials.commitments", values.testimonials.commitments.join("\n"));

  set("faq.eyebrow", values.faq.eyebrow);
  set("faq.title", values.faq.title);
  set("faq.description", values.faq.description);
  set("faq.linkLabel", values.faq.linkLabel);
  set("faq.linkHref", values.faq.linkHref);
  set("faq.defaultOpen", values.faq.defaultOpen);
  values.faq.items.forEach((item, index) => {
    set(`faq.items.${index}.id`, item.id);
    set(`faq.items.${index}.question`, item.question);
    set(`faq.items.${index}.answer`, item.answer);
    set(`faq.items.${index}.link.label`, item.link?.label ?? "");
    set(`faq.items.${index}.link.href`, item.link?.href ?? "/data-sources");
  });

  set("finalCta.badge", values.finalCta.badge);
  set("finalCta.title", values.finalCta.title);
  set("finalCta.description", values.finalCta.description);
  set("finalCta.primaryCta.label", values.finalCta.primaryCta.label);
  set("finalCta.primaryCta.href", values.finalCta.primaryCta.href);
  set("finalCta.secondaryCta.label", values.finalCta.secondaryCta.label);
  set("finalCta.secondaryCta.href", values.finalCta.secondaryCta.href);
  set("finalCta.note", values.finalCta.note);

  return form;
}

describe("homepage CMS contract", () => {
  it("ships valid default copy", () => {
    expect(
      homepageContentSchema.safeParse(defaultHomepageContent).success,
    ).toBe(true);
    expect(defaultHomepageContent.faq.items.length).toBeGreaterThan(0);
  });

  it("rebuilds the full document from the editor's flat fields", () => {
    const parsed = homepageContentSchema.parse(
      homepageContentFromFormData(toFormData(defaultHomepageContent)),
    );

    expect(parsed).toEqual(defaultHomepageContent);
  });

  it("treats an empty optional FAQ link as no link", () => {
    const form = toFormData(defaultHomepageContent);
    form.set("faq.items.0.link.href", "https://attacker.example");

    const parsed = homepageContentSchema.parse(
      homepageContentFromFormData(form),
    );

    expect(parsed.faq.items[0].link).toBeNull();
  });

  it("rejects markup and control characters", () => {
    const markup = clone(defaultHomepageContent);
    markup.hero.description = "Welcome <script>alert(1)</script>";

    const control = clone(defaultHomepageContent);
    control.finalCta.note = "Safe text\u0000with a control character";

    expect(homepageContentSchema.safeParse(markup).success).toBe(false);
    expect(homepageContentSchema.safeParse(control).success).toBe(false);
  });

  it("rejects unknown keys and unexpected structure", () => {
    const extra = {
      ...clone(defaultHomepageContent),
      theme: { customCss: "body { display: none; }" },
    };
    const wrongLength = clone(defaultHomepageContent);
    wrongLength.hero.pillars = ["Only one pillar"];

    expect(homepageContentSchema.safeParse(extra).success).toBe(false);
    expect(homepageContentSchema.safeParse(wrongLength).success).toBe(false);
  });

  it("only permits internal allowlisted destinations", () => {
    for (const href of [
      "https://example.com",
      "javascript:alert(1)",
      "data:text/html,<script>",
      "//example.com",
      "/admin",
    ]) {
      const invalid = clone(defaultHomepageContent);
      invalid.hero.primaryCta.href = href as never;
      expect(homepageContentSchema.safeParse(invalid).success).toBe(false);
    }

    for (const href of HOMEPAGE_HREFS) {
      const valid = clone(defaultHomepageContent);
      valid.hero.primaryCta.href = href;
      expect(homepageContentSchema.safeParse(valid).success).toBe(true);
    }
  });

  it("keeps FAQ defaults consistent with the answer list", () => {
    const duplicate = clone(defaultHomepageContent);
    duplicate.faq.items[1].id = duplicate.faq.items[0].id;
    const missingDefault = clone(defaultHomepageContent);
    missingDefault.faq.defaultOpen = "does-not-exist";

    expect(homepageContentSchema.safeParse(duplicate).success).toBe(false);
    expect(homepageContentSchema.safeParse(missingDefault).success).toBe(false);
  });
});
