import { z } from "zod";

/**
 * Every homepage value is plain text or an allowlisted internal destination.
 * The document is rendered through React text nodes and fixed components, never
 * as HTML, CSS, or script. Unknown keys are rejected so an upstream form or API
 * cannot smuggle additional behaviour into the stored document.
 */
export const HOMEPAGE_HREFS = [
  "/",
  "/register",
  "/login",
  "/dashboard",
  "/universities",
  "/scholarships",
  "/privacy",
  "/terms",
  "/data-sources",
  "/#universities",
  "/#scholarships",
  "/#how-it-works",
  "/#features",
  "/#advisor",
  "/#verification",
  "/#faq",
] as const;

export const HOMEPAGE_ID = "home" as const;
export const HOMEPAGE_CACHE_TAG = "homepage-content" as const;

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

const plainText = (max: number, label = "text", min = 1) =>
  z
    .string()
    .trim()
    .min(min, `Enter the ${label}.`)
    .max(max, `Keep the ${label} under ${max} characters.`)
    .refine(
      (value) => !/[<>]/.test(value) && !CONTROL_CHARACTERS.test(value),
      "Use plain text only; markup and control characters are not allowed.",
    );

const id = z
  .string()
  .trim()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers, and single hyphens.",
  );

const href = z.enum(HOMEPAGE_HREFS, {
  error: "Choose an allowed internal destination.",
});

const callToAction = z
  .object({
    label: plainText(60, "button label"),
    href,
  })
  .strict();

const optionalCallToAction = z
  .object({
    label: plainText(60, "link label"),
    href,
  })
  .nullable();

const textList = (count: number, max = 140) =>
  z.array(plainText(max, "list item")).length(count);

export const homepageContentSchema = z
  .object({
    hero: z
      .object({
        eyebrow: plainText(120, "hero badge"),
        titleLead: plainText(140, "hero title"),
        titleAccent: plainText(100, "highlighted hero title"),
        description: plainText(500, "hero description"),
        primaryCta: callToAction,
        secondaryCta: callToAction,
        pillars: textList(3, 100),
      })
      .strict(),
    universitySearch: z
      .object({
        eyebrow: plainText(80, "section eyebrow"),
        title: plainText(200, "section title"),
        description: plainText(600, "section description"),
        linkLabel: plainText(80, "link label"),
        linkHref: href,
      })
      .strict(),
    howItWorks: z
      .object({
        eyebrow: plainText(80, "section eyebrow"),
        title: plainText(200, "section title"),
        description: plainText(600, "section description"),
        steps: z
          .array(
            z
              .object({
                title: plainText(120, "step title"),
                description: plainText(400, "step description"),
                meta: plainText(140, "step caption"),
              })
              .strict(),
          )
          .length(3),
      })
      .strict(),
    features: z
      .object({
        eyebrow: plainText(80, "section eyebrow"),
        title: plainText(200, "section title"),
        description: plainText(600, "section description"),
        linkLabel: plainText(80, "link label"),
        linkHref: href,
      })
      .strict(),
    scholarships: z
      .object({
        eyebrow: plainText(80, "section eyebrow"),
        title: plainText(200, "section title"),
        description: plainText(600, "section description"),
        benefits: textList(4, 180),
        filtersNote: plainText(100, "filters caption"),
        filterChips: textList(7, 80),
        ctaLabel: plainText(80, "button label"),
        ctaHref: href,
        liveNote: plainText(160, "live note"),
      })
      .strict(),
    advisor: z
      .object({
        badge: plainText(80, "advisor badge"),
        titleLine1: plainText(120, "advisor title"),
        titleLine2: plainText(120, "advisor title"),
        description: plainText(600, "advisor description"),
        capabilities: z
          .array(
            z
              .object({
                title: plainText(120, "capability title"),
                description: plainText(300, "capability description"),
              })
              .strict(),
          )
          .length(4),
        disclaimerLead: plainText(120, "disclaimer heading"),
        disclaimerBody: plainText(500, "disclaimer"),
      })
      .strict(),
    verification: z
      .object({
        eyebrow: plainText(80, "section eyebrow"),
        title: plainText(200, "section title"),
        description: plainText(600, "section description"),
        linkLabel: plainText(80, "link label"),
        linkHref: href,
        stats: z
          .array(
            z
              .object({
                value: plainText(12, "statistic value"),
                label: plainText(180, "statistic label"),
              })
              .strict(),
          )
          .length(4),
        note: plainText(400, "statistics note"),
        principles: z
          .array(
            z
              .object({
                title: plainText(120, "principle title"),
                description: plainText(400, "principle description"),
              })
              .strict(),
          )
          .length(3),
        statusesNote: plainText(200, "status note"),
      })
      .strict(),
    testimonials: z
      .object({
        eyebrow: plainText(80, "section eyebrow"),
        title: plainText(200, "section title"),
        description: plainText(600, "section description"),
        quote: plainText(800, "placeholder quote"),
        placeholderLabel: plainText(100, "placeholder label"),
        placeholderNote: plainText(200, "placeholder note"),
        commitmentLabel: plainText(100, "commitment heading"),
        commitments: textList(3, 180),
      })
      .strict(),
    faq: z
      .object({
        eyebrow: plainText(80, "section eyebrow"),
        title: plainText(200, "section title"),
        description: plainText(600, "section description"),
        linkLabel: plainText(80, "link label"),
        linkHref: href,
        defaultOpen: id,
        items: z
          .array(
            z
              .object({
                id,
                question: plainText(200, "question"),
                answer: plainText(900, "answer"),
                link: optionalCallToAction,
              })
              .strict(),
          )
          .min(1)
          .max(12),
      })
      .strict(),
    finalCta: z
      .object({
        badge: plainText(100, "closing badge"),
        title: plainText(200, "closing title"),
        description: plainText(600, "closing description"),
        primaryCta: callToAction,
        secondaryCta: callToAction,
        note: plainText(240, "closing note"),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const ids = new Set<string>();
    for (const [index, item] of value.faq.items.entries()) {
      if (ids.has(item.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["faq", "items", index, "id"],
          message: "FAQ ids must be unique.",
        });
      }
      ids.add(item.id);
    }
    if (!ids.has(value.faq.defaultOpen)) {
      ctx.addIssue({
        code: "custom",
        path: ["faq", "defaultOpen"],
        message: "Choose the id of a question in this FAQ.",
      });
    }
  });

export type HomepageContent = z.infer<typeof homepageContentSchema>;
export type HeroContent = HomepageContent["hero"];
export type UniversitySearchContent = HomepageContent["universitySearch"];
export type HowItWorksContent = HomepageContent["howItWorks"];
export type FeaturesContent = HomepageContent["features"];
export type ScholarshipsContent = HomepageContent["scholarships"];
export type AdvisorContent = HomepageContent["advisor"];
export type VerificationContent = HomepageContent["verification"];
export type TestimonialsContent = HomepageContent["testimonials"];
export type FaqContent = HomepageContent["faq"];
export type FinalCtaContent = HomepageContent["finalCta"];

/** The shipped copy, also used as the fallback when the CMS row is absent. */
export const defaultHomepageContent: HomepageContent = {
  hero: {
    eyebrow: "For students from Uzbekistan, Central Asia & beyond",
    titleLead: "Your Future Starts With the",
    titleAccent: "Right University.",
    description:
      "Discover international universities, find scholarships, and manage your entire application journey in one place.",
    primaryCta: { label: "Get Started", href: "/register" },
    secondaryCta: { label: "Explore Universities", href: "/#universities" },
    pillars: [
      "Source-linked data",
      "Private documents",
      "AI guidance with citations",
    ],
  },
  universitySearch: {
    eyebrow: "University discovery",
    title: "Find a university that fits the life you want.",
    description:
      "Search by destination, degree, and field. Every live record will show its official source, verification date, and review status — so you can check before you act.",
    linkLabel: "How we verify data",
    linkHref: "/#verification",
  },
  howItWorks: {
    eyebrow: "How it works",
    title: "From first search to final submission.",
    description:
      "A single, calm workflow for the parts of studying abroad that usually live in five different tabs.",
    steps: [
      {
        title: "Build your profile",
        description:
          "Add your education, intended degree, budget, preferred countries, and any test scores. Better context leads to more relevant options — and your profile stays private.",
        meta: "Education · Scores · Budget · Goals",
      },
      {
        title: "Explore verified options",
        description:
          "Filter universities and scholarships by the things that matter. Important facts link to official sources and show when they were last verified.",
        meta: "Filters · Sources · Verification dates",
      },
      {
        title: "Apply with a plan",
        description:
          "Move each application through a clear pipeline, keep documents organized, watch deadlines, and turn requirements into an actionable checklist.",
        meta: "Kanban · Documents · Deadlines",
      },
    ],
  },
  features: {
    eyebrow: "The workspace",
    title: "One workspace for the whole journey.",
    description:
      "Not another folder of links. EduBridge keeps applications, requirements, documents, and deadlines connected — with the source of every important fact close at hand.",
    linkLabel: "Meet the AI advisor",
    linkHref: "/#advisor",
  },
  scholarships: {
    eyebrow: "Scholarship discovery",
    title: "Funding shouldn't be a guessing game.",
    description:
      "Search scholarships by funding level, nationality eligibility, degree, field, and deadline. See exactly which criteria match your profile — and which ones remain unknown.",
    benefits: [
      "Fully funded and partial awards in one search",
      "Nationality, degree, and field eligibility",
      "Deadline reminders before it is too late",
      "Save, shortlist, and add to your tracker",
    ],
    filtersNote: "Filters at launch",
    filterChips: [
      "Fully funded",
      "Partial funding",
      "Bachelor's",
      "Master's",
      "PhD",
      "No IELTS required",
      "Deadline this month",
    ],
    ctaLabel: "Ask the advisor",
    ctaHref: "/#advisor",
    liveNote: "Live catalog opens with verified records",
  },
  advisor: {
    badge: "AI University Advisor",
    titleLine1: "Ask better questions.",
    titleLine2: "Get source-aware answers.",
    description:
      "Your advisor understands your academic profile, explains admission requirements, finds gaps in your documents, and helps you organize a plan — with the limits of its knowledge made explicit.",
    capabilities: [
      {
        title: "Built from your profile",
        description:
          "Uses your education, scores, budget, destinations, and intended degree.",
      },
      {
        title: "Uncertainty is stated",
        description:
          "Separates verified facts, general guidance, and what still needs checking.",
      },
      {
        title: "Sources stay attached",
        description:
          "Points back to official university and scholarship pages whenever available.",
      },
      {
        title: "Checklists, not decisions",
        description:
          "Turns requirements into next steps. It does not make admission decisions.",
      },
    ],
    disclaimerLead: "AI can make mistakes.",
    disclaimerBody:
      "EduBridge never guarantees admission or funding, and does not make final admissions decisions. Always confirm details with the official institution.",
  },
  verification: {
    eyebrow: "Built on evidence",
    title: "Trust is a data feature.",
    description:
      "University requirements change every cycle. EduBridge is designed so every important fact can be traced, dated, and reviewed — and so missing information is obvious rather than hidden.",
    linkLabel: "Read our data approach",
    linkHref: "/data-sources",
    stats: [
      { value: "4", label: "universities compared side by side" },
      { value: "9", label: "application stages, from interested to accepted" },
      { value: "8", label: "secure document categories" },
      { value: "4", label: "verification states on important facts" },
    ],
    note: "These are platform capabilities, not traction metrics. We will not publish user counts or success rates until they are real and verifiable.",
    principles: [
      {
        title: "Source before claim",
        description:
          "Important facts are tied to an official URL, a publishing organization, and the date the fact was captured.",
      },
      {
        title: "Human review",
        description:
          "Ambiguous or conflicting information is flagged for review instead of being published as a confident answer.",
      },
      {
        title: "Review by default",
        description:
          "Requirements and deadlines expire. Records carry review reminders so old facts cannot quietly become current ones.",
      },
    ],
    statusesNote: "Every key record carries one of four states:",
  },
  testimonials: {
    eyebrow: "Student stories",
    title: "Real experiences, only when they're real.",
    description:
      "We are not publishing invented testimonials to make the product look finished. This space is reserved for students who choose to share their story after launch.",
    quote:
      "We don't publish testimonials we can't verify. When students share their stories here, you'll see them with permission and context — not as marketing copy.",
    placeholderLabel: "Development placeholder",
    placeholderNote: "No student testimonial has been published.",
    commitmentLabel: "Our commitment",
    commitments: [
      "Published only with explicit permission",
      "Context included, including country and degree",
      "No promised outcomes or edited results",
    ],
  },
  faq: {
    eyebrow: "FAQ",
    title: "Straight answers, before you ask.",
    description:
      "If something is not clear, it is usually because the answer is still being built. These are the decisions we have made so far.",
    linkLabel: "How we handle data sources",
    linkHref: "/data-sources",
    defaultOpen: "data",
    items: [
      {
        id: "pricing",
        question: "Is EduBridge free to use?",
        answer:
          "Core student discovery and application tracking are planned to be free. We have not finalized pricing for future counselor or institution tools; if that changes, pricing will be published clearly before launch.",
        link: null,
      },
      {
        id: "data",
        question:
          "Where does university and scholarship information come from?",
        answer:
          "Important records are intended to link to an official university, government, or scholarship-provider page. We record the source URL, the publishing organization, and the verification date. Information we cannot verify is labeled unverified or left out — never presented as fact.",
        link: {
          label: "Read the data sources policy",
          href: "/data-sources",
        },
      },
      {
        id: "ai",
        question: "Can the AI advisor guarantee admission or a scholarship?",
        answer:
          "No. The advisor helps you understand requirements, compare options, and build an application plan. It does not make final decisions, predict outcomes, or replace official guidance. Always confirm details with the institution or scholarship provider.",
        link: null,
      },
      {
        id: "documents",
        question: "How will my documents be protected?",
        answer:
          "Documents are designed to live in private storage with owner-only access. Uploads will be type- and size-validated, file URLs will not be publicly accessible, and uploaded files will never be executed. You will be able to delete your account and associated data when accounts open.",
        link: null,
      },
      {
        id: "languages",
        question: "Which languages are supported?",
        answer:
          "English is the default interface today. Uzbek and Russian are planned before public launch. The platform is being structured with localization in mind rather than treating translation as an afterthought.",
        link: null,
      },
      {
        id: "countries",
        question: "Which countries can I explore?",
        answer:
          "EduBridge is being built for international applicants worldwide, with an initial focus on students from Uzbekistan and Central Asia. We will publish the catalog by destination as records pass verification rather than promise coverage numbers before they are real.",
        link: null,
      },
      {
        id: "privacy",
        question: "Do you sell personal data?",
        answer:
          "No. EduBridge is not an advertising business. We intend to collect only what the product needs, explain each category, and provide a deletion path. Accounts are not open yet, so this site currently collects no student records.",
        link: { label: "Read the privacy notice", href: "/privacy" },
      },
    ],
  },
  finalCta: {
    badge: "Pre-launch · built in public",
    title: "Build your bridge to the right university.",
    description:
      "Start with better information: source-linked universities, scholarships you can actually investigate, and one calm workspace for the application ahead.",
    primaryCta: { label: "Get Started", href: "/register" },
    secondaryCta: { label: "Find Scholarships", href: "/#scholarships" },
    note: "No invented outcomes. No guaranteed admissions. Just better information.",
  },
};

function value(formData: FormData, path: string): string {
  const entry = formData.get(path);
  return typeof entry === "string" ? entry.trim() : "";
}

function lines(formData: FormData, path: string): string[] {
  return value(formData, path)
    .split(/[\n|]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function link(formData: FormData, prefix: string) {
  const label = value(formData, `${prefix}.label`);
  const destination = value(formData, `${prefix}.href`);
  // Optional links are represented by an empty label. A label without a
  // destination is kept so the schema can report the precise field error.
  if (!label) return null;
  return { label, href: destination };
}

function faqItems(formData: FormData) {
  const items: {
    id: string;
    question: string;
    answer: string;
    link: { label: string; href: string } | null;
  }[] = [];

  for (let index = 0; index < 12; index += 1) {
    const prefix = `faq.items.${index}`;
    const question = value(formData, `${prefix}.question`);
    const answer = value(formData, `${prefix}.answer`);
    if (!question && !answer) continue;
    items.push({
      id: value(formData, `${prefix}.id`),
      question,
      answer,
      link: link(formData, `${prefix}.link`),
    });
  }
  return items;
}

/**
 * The editor posts flat, named fields. Rebuild the structured document here so
 * validation happens once, in one place, before any database write.
 */
export function homepageContentFromFormData(
  formData: FormData,
): Record<string, unknown> {
  return {
    hero: {
      eyebrow: value(formData, "hero.eyebrow"),
      titleLead: value(formData, "hero.titleLead"),
      titleAccent: value(formData, "hero.titleAccent"),
      description: value(formData, "hero.description"),
      primaryCta: link(formData, "hero.primaryCta"),
      secondaryCta: link(formData, "hero.secondaryCta"),
      pillars: lines(formData, "hero.pillars"),
    },
    universitySearch: {
      eyebrow: value(formData, "universitySearch.eyebrow"),
      title: value(formData, "universitySearch.title"),
      description: value(formData, "universitySearch.description"),
      linkLabel: value(formData, "universitySearch.linkLabel"),
      linkHref: value(formData, "universitySearch.linkHref"),
    },
    howItWorks: {
      eyebrow: value(formData, "howItWorks.eyebrow"),
      title: value(formData, "howItWorks.title"),
      description: value(formData, "howItWorks.description"),
      steps: [0, 1, 2].map((index) => ({
        title: value(formData, `howItWorks.steps.${index}.title`),
        description: value(formData, `howItWorks.steps.${index}.description`),
        meta: value(formData, `howItWorks.steps.${index}.meta`),
      })),
    },
    features: {
      eyebrow: value(formData, "features.eyebrow"),
      title: value(formData, "features.title"),
      description: value(formData, "features.description"),
      linkLabel: value(formData, "features.linkLabel"),
      linkHref: value(formData, "features.linkHref"),
    },
    scholarships: {
      eyebrow: value(formData, "scholarships.eyebrow"),
      title: value(formData, "scholarships.title"),
      description: value(formData, "scholarships.description"),
      benefits: lines(formData, "scholarships.benefits"),
      filtersNote: value(formData, "scholarships.filtersNote"),
      filterChips: lines(formData, "scholarships.filterChips"),
      ctaLabel: value(formData, "scholarships.ctaLabel"),
      ctaHref: value(formData, "scholarships.ctaHref"),
      liveNote: value(formData, "scholarships.liveNote"),
    },
    advisor: {
      badge: value(formData, "advisor.badge"),
      titleLine1: value(formData, "advisor.titleLine1"),
      titleLine2: value(formData, "advisor.titleLine2"),
      description: value(formData, "advisor.description"),
      capabilities: [0, 1, 2, 3].map((index) => ({
        title: value(formData, `advisor.capabilities.${index}.title`),
        description: value(
          formData,
          `advisor.capabilities.${index}.description`,
        ),
      })),
      disclaimerLead: value(formData, "advisor.disclaimerLead"),
      disclaimerBody: value(formData, "advisor.disclaimerBody"),
    },
    verification: {
      eyebrow: value(formData, "verification.eyebrow"),
      title: value(formData, "verification.title"),
      description: value(formData, "verification.description"),
      linkLabel: value(formData, "verification.linkLabel"),
      linkHref: value(formData, "verification.linkHref"),
      stats: [0, 1, 2, 3].map((index) => ({
        value: value(formData, `verification.stats.${index}.value`),
        label: value(formData, `verification.stats.${index}.label`),
      })),
      note: value(formData, "verification.note"),
      principles: [0, 1, 2].map((index) => ({
        title: value(formData, `verification.principles.${index}.title`),
        description: value(
          formData,
          `verification.principles.${index}.description`,
        ),
      })),
      statusesNote: value(formData, "verification.statusesNote"),
    },
    testimonials: {
      eyebrow: value(formData, "testimonials.eyebrow"),
      title: value(formData, "testimonials.title"),
      description: value(formData, "testimonials.description"),
      quote: value(formData, "testimonials.quote"),
      placeholderLabel: value(formData, "testimonials.placeholderLabel"),
      placeholderNote: value(formData, "testimonials.placeholderNote"),
      commitmentLabel: value(formData, "testimonials.commitmentLabel"),
      commitments: lines(formData, "testimonials.commitments"),
    },
    faq: {
      eyebrow: value(formData, "faq.eyebrow"),
      title: value(formData, "faq.title"),
      description: value(formData, "faq.description"),
      linkLabel: value(formData, "faq.linkLabel"),
      linkHref: value(formData, "faq.linkHref"),
      defaultOpen: value(formData, "faq.defaultOpen"),
      items: faqItems(formData),
    },
    finalCta: {
      badge: value(formData, "finalCta.badge"),
      title: value(formData, "finalCta.title"),
      description: value(formData, "finalCta.description"),
      primaryCta: link(formData, "finalCta.primaryCta"),
      secondaryCta: link(formData, "finalCta.secondaryCta"),
      note: value(formData, "finalCta.note"),
    },
  };
}
