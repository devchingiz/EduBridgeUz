/**
 * Hand-verified catalog records.
 *
 * Every fact below was read on an official provider page on the date in
 * `verifiedAt`. Nothing is estimated: where a provider publishes a range,
 * eligibility rule, or unknown amount, the record stores the wording or leaves
 * the value out. Tuition amounts are in minor units of the stated currency.
 *
 * This module is intentionally free of path aliases so the Node seed runner can
 * import it with native type stripping.
 */

export type SeedCitation = {
  url: string;
  publisher: string;
  title: string;
  accessedAt: string;
  verifiedAt: string;
  notes?: string;
};

export const seedCitations = {
  tumProgram: {
    url: "https://www.tum.de/en/studies/degree-programs/detail/informatics-master-of-science-msc",
    publisher: "Technical University of Munich",
    title: "Informatics (Master of Science) — TUM degree program page",
    accessedAt: "2026-11-12",
    verifiedAt: "2026-11-12",
  },
  tumAbout: {
    url: "https://www.tum.de/en/about-tum",
    publisher: "Technical University of Munich",
    title: "About TUM",
    accessedAt: "2026-11-12",
    verifiedAt: "2026-11-12",
  },
  uvaProgram: {
    url: "https://www.uva.nl/en/programmes/masters/computer-science/computer-science.html",
    publisher: "University of Amsterdam",
    title: "Computer Science (MSc) — University of Amsterdam",
    accessedAt: "2026-11-12",
    verifiedAt: "2026-11-12",
  },
  uvaAdmission: {
    url: "https://www.uva.nl/shared-content/programmas/en/masters/computer-science/application-and-admission/application-and-admission.html",
    publisher: "University of Amsterdam",
    title: "Computer Science (MSc) — application and admission",
    accessedAt: "2026-11-12",
    verifiedAt: "2026-11-12",
  },
  uvaFees: {
    url: "https://www.uva.nl/en/education/fees-and-funding/tuition-fees/tuition-fees.html",
    publisher: "University of Amsterdam",
    title: "Tuition fees — University of Amsterdam",
    accessedAt: "2026-11-12",
    verifiedAt: "2026-11-12",
  },
  tudelftProgram: {
    url: "https://www.tudelft.nl/en/education/programmes/masters/cs/msc-computer-science",
    publisher: "Delft University of Technology",
    title: "MSc Computer Science — TU Delft",
    accessedAt: "2026-11-12",
    verifiedAt: "2026-11-12",
  },
  tudelftAdmission: {
    url: "https://www.tudelft.nl/en/education/programmes/masters/cs/msc-computer-science/admission-and-application/non-eu-efta-applicants-with-an-international-bachelor-degree",
    publisher: "Delft University of Technology",
    title:
      "MSc Computer Science — admission for non-EU/EFTA applicants with an international bachelor's degree",
    accessedAt: "2026-11-12",
    verifiedAt: "2026-11-12",
  },
  manchesterProgram: {
    url: "https://www.manchester.ac.uk/study/masters/courses/list/21573/msc-advanced-computer-science/",
    publisher: "The University of Manchester",
    title: "MSc Advanced Computer Science (2027 entry) — course details",
    accessedAt: "2026-11-12",
    verifiedAt: "2026-11-12",
  },
  manchesterAbout: {
    url: "https://www.manchester.ac.uk/about/",
    publisher: "The University of Manchester",
    title: "About The University of Manchester",
    accessedAt: "2026-11-12",
    verifiedAt: "2026-11-12",
  },
  siScholarship: {
    url: "https://si.se/en/apply/scholarships/swedish-institute-scholarships-for-global-professionals/",
    publisher: "Swedish Institute",
    title: "Swedish Institute Scholarships for Global Professionals",
    accessedAt: "2026-11-12",
    verifiedAt: "2026-11-12",
  },
  erasmusMundus: {
    url: "https://erasmus-plus.ec.europa.eu/opportunities/opportunities-for-individuals/students/erasmus-mundus-joint-masters-scholarships",
    publisher: "European Commission — Erasmus+",
    title: "Erasmus Mundus Joint Masters scholarships",
    accessedAt: "2026-11-12",
    verifiedAt: "2026-11-12",
  },
} satisfies Record<string, SeedCitation>;

export type CitationKey = keyof typeof seedCitations;

export type SeedRequirement = {
  kind:
    | "ACADEMIC"
    | "ENGLISH_LANGUAGE"
    | "DOCUMENT"
    | "PORTFOLIO"
    | "WORK_EXPERIENCE"
    | "OTHER";
  summary: string;
  source?: CitationKey;
};

export type SeedTuition = {
  amountMinor: number;
  currency: string;
  period: string;
  applicantGroup: string | null;
  note: string | null;
  source?: CitationKey;
};

export type SeedDeadline = {
  cycle: string;
  applicantGroup: string | null;
  opensOn?: string;
  deadlineOn?: string;
  opensMonthDay?: string;
  deadlineMonthDay?: string;
  note: string | null;
  source?: CitationKey;
};

export type SeedIntake = {
  term: "SPRING" | "SUMMER" | "AUTUMN" | "WINTER";
  note?: string | null;
  source?: CitationKey;
};

export type SeedProgram = {
  slug: string;
  name: string;
  degreeLevel: "BACHELOR" | "MASTER" | "PHD" | "DIPLOMA" | "CERTIFICATE";
  field: string;
  language: string | null;
  durationMonths: number | null;
  credits: number | null;
  startNote: string | null;
  source: CitationKey;
  intakes?: SeedIntake[];
  requirements: SeedRequirement[];
  tuition: SeedTuition[];
  deadlines: SeedDeadline[];
};

export type SeedUniversity = {
  slug: string;
  name: string;
  shortName: string | null;
  city: string;
  countryCode: string;
  websiteUrl: string;
  source: CitationKey;
  programs: SeedProgram[];
};

export type SeedScholarship = {
  slug: string;
  name: string;
  providerName: string;
  providerUrl: string;
  hostCountryCode: string | null;
  fundingType:
    "FULLY_FUNDED" | "PARTIAL" | "TUITION_WAIVER" | "STIPEND" | "OTHER";
  degreeLevels: ("BACHELOR" | "MASTER" | "PHD" | "DIPLOMA" | "CERTIFICATE")[];
  nationalityScope: "ALL" | "LISTED" | "UNKNOWN";
  eligibleNationalities: string[];
  fieldScope: "ALL" | "LISTED" | "UNKNOWN";
  fields: string[];
  summary: string;
  source: CitationKey;
  requirements: SeedRequirement[];
  deadlines: SeedDeadline[];
};

export const seedUniversities: SeedUniversity[] = [
  {
    slug: "technical-university-of-munich",
    name: "Technical University of Munich",
    shortName: "TUM",
    city: "Munich",
    countryCode: "DE",
    websiteUrl: "https://www.tum.de/en/",
    source: "tumAbout",
    programs: [
      {
        slug: "msc-informatics",
        name: "Informatics",
        degreeLevel: "MASTER",
        field: "Computer Science",
        language: "English",
        durationMonths: 24,
        credits: 120,
        startNote: "Winter and summer semester",
        source: "tumProgram",
        intakes: [
          { term: "WINTER", source: "tumProgram" },
          { term: "SUMMER", source: "tumProgram" },
        ],
        requirements: [
          {
            kind: "ACADEMIC",
            summary:
              "A recognized bachelor's degree in informatics or a closely related field, confirmed through the program's aptitude assessment.",
          },
          {
            kind: "OTHER",
            summary:
              "The aptitude assessment (Eignungsverfahren) is part of the admission process.",
          },
          {
            kind: "ENGLISH_LANGUAGE",
            summary:
              "English language proficiency must be demonstrated as part of the application.",
          },
          {
            kind: "DOCUMENT",
            summary:
              "Applicants with a foreign degree need a uni-assist preliminary review documentation (VPD).",
          },
        ],
        tuition: [
          {
            amountMinor: 9700,
            currency: "EUR",
            period: "per semester",
            applicantGroup: "All students",
            note: "Student Fees (Studierendenbeitrag).",
          },
          {
            amountMinor: 600000,
            currency: "EUR",
            period: "per semester",
            applicantGroup: "International students from third countries",
            note: null,
          },
        ],
        deadlines: [
          {
            cycle: "Winter semester",
            applicantGroup: "All applicants",
            opensMonthDay: "02-01",
            deadlineMonthDay: "05-31",
            note: null,
          },
          {
            cycle: "Summer semester",
            applicantGroup: "All applicants",
            opensMonthDay: "10-01",
            deadlineMonthDay: "11-30",
            note: null,
          },
        ],
      },
    ],
  },
  {
    slug: "university-of-amsterdam",
    name: "University of Amsterdam",
    shortName: "UvA",
    city: "Amsterdam",
    countryCode: "NL",
    websiteUrl: "https://www.uva.nl/en",
    source: "uvaProgram",
    programs: [
      {
        slug: "msc-computer-science",
        name: "Computer Science",
        degreeLevel: "MASTER",
        field: "Computer Science",
        language: "English",
        durationMonths: 24,
        credits: 120,
        startNote: "September",
        source: "uvaProgram",
        requirements: [
          {
            kind: "OTHER",
            summary:
              "This is a joint degree of the University of Amsterdam and Vrije Universiteit Amsterdam; applications are submitted through VU Amsterdam.",
            source: "uvaAdmission",
          },
        ],
        tuition: [
          {
            amountMinor: 277100,
            currency: "EUR",
            period: "per academic year",
            applicantGroup:
              "Dutch, EU/EEA and Swiss students (statutory fee, 2027–28)",
            note: "Statutory tuition fee for full-time study in 2027–28.",
            source: "uvaFees",
          },
        ],
        deadlines: [
          {
            cycle: "Annual intake",
            applicantGroup:
              "Applicants with Dutch prior education and EU/EEA international applicants",
            deadlineMonthDay: "06-01",
            note: "Non-EU/EEA applicants have a separate deadline; check the official admission page.",
            source: "uvaAdmission",
          },
        ],
      },
    ],
  },
  {
    slug: "delft-university-of-technology",
    name: "Delft University of Technology",
    shortName: "TU Delft",
    city: "Delft",
    countryCode: "NL",
    websiteUrl: "https://www.tudelft.nl/en/",
    source: "tudelftProgram",
    programs: [
      {
        slug: "msc-computer-science",
        name: "Computer Science",
        degreeLevel: "MASTER",
        field: "Computer Science",
        language: "English",
        durationMonths: 24,
        credits: 120,
        startNote: "September",
        source: "tudelftProgram",
        requirements: [
          {
            kind: "ACADEMIC",
            summary:
              "For non-EU/EFTA applicants with an international bachelor's degree: an engineering bachelor's degree in computer science or a closely related field.",
            source: "tudelftAdmission",
          },
          {
            kind: "DOCUMENT",
            summary:
              "A GRE revised General Test result is required for non-EU/EFTA applicants with an international bachelor's degree.",
            source: "tudelftAdmission",
          },
          {
            kind: "ACADEMIC",
            summary:
              "Specific computer science course credits are required; the official admission page lists the exact EC requirements.",
            source: "tudelftAdmission",
          },
          {
            kind: "OTHER",
            summary:
              "Admission for non-EU/EFTA applicants with an international bachelor's degree is a ranked, batch selection process.",
            source: "tudelftAdmission",
          },
        ],
        // Tuition is deliberately absent: the program's finances page links to a
        // central TU Delft page that does not state an amount for this program.
        tuition: [],
        deadlines: [
          {
            cycle: "Non-EU/EFTA international applicants",
            applicantGroup:
              "Non-EU/EFTA applicants with an international bachelor's degree",
            deadlineMonthDay: "01-15",
            note: "The official page states 15 January at 23:59 CEST.",
            source: "tudelftAdmission",
          },
        ],
      },
    ],
  },
  {
    slug: "university-of-manchester",
    name: "The University of Manchester",
    shortName: "Manchester",
    city: "Manchester",
    countryCode: "GB",
    websiteUrl: "https://www.manchester.ac.uk/",
    source: "manchesterAbout",
    programs: [
      {
        slug: "msc-advanced-computer-science",
        name: "Advanced Computer Science",
        degreeLevel: "MASTER",
        field: "Computer Science",
        // The course page does not state the language of instruction, so it is
        // left unknown rather than inferred from the institution's location.
        language: null,
        durationMonths: 12,
        credits: null,
        startNote: "2027 entry",
        source: "manchesterProgram",
        requirements: [
          {
            kind: "ACADEMIC",
            summary:
              "A first-class honours degree (70%) with at least 50% computer science content.",
          },
          {
            kind: "ENGLISH_LANGUAGE",
            summary: "IELTS 7.0 overall with no subskill below 6.5.",
          },
          {
            kind: "ENGLISH_LANGUAGE",
            summary: "TOEFL iBT 100 overall with no subskill below 22.",
          },
          {
            kind: "ENGLISH_LANGUAGE",
            summary: "PTE Academic 76 overall with no subskill below 70.",
          },
        ],
        tuition: [
          {
            amountMinor: 1760000,
            currency: "GBP",
            period: "per annum",
            applicantGroup: "UK students",
            note: "2027 entry.",
          },
          {
            amountMinor: 4140000,
            currency: "GBP",
            period: "per annum",
            applicantGroup: "International students, including EU",
            note: "2027 entry.",
          },
        ],
        deadlines: [
          {
            cycle: "2027 entry",
            applicantGroup: "All applicants",
            deadlineOn: "2026-11-06",
            note: "Stage 1 of four staged deadlines.",
          },
          {
            cycle: "2027 entry",
            applicantGroup: "All applicants",
            deadlineOn: "2027-01-01",
            note: "Stage 2 of four staged deadlines.",
          },
          {
            cycle: "2027 entry",
            applicantGroup: "All applicants",
            deadlineOn: "2027-02-26",
            note: "Stage 3 of four staged deadlines.",
          },
          {
            cycle: "2027 entry",
            applicantGroup: "All applicants",
            deadlineOn: "2027-05-21",
            note: "Stage 4 of four staged deadlines.",
          },
        ],
      },
    ],
  },
];

export const seedScholarships: SeedScholarship[] = [
  {
    slug: "swedish-institute-scholarships-for-global-professionals",
    name: "Swedish Institute Scholarships for Global Professionals",
    providerName: "Swedish Institute",
    providerUrl: "https://si.se/en/",
    hostCountryCode: "SE",
    fundingType: "FULLY_FUNDED",
    degreeLevels: ["MASTER"],
    nationalityScope: "LISTED",
    // The provider lists 34 eligible countries. Only Uzbekistan has been
    // recorded so far; the summary tells readers the full list is on the
    // provider's page rather than implying this is the complete set.
    eligibleNationalities: ["UZ"],
    fieldScope: "LISTED",
    fields: [
      "Governance",
      "Public Health",
      "Entrepreneurship and Innovation",
      "STEM",
    ],
    summary:
      "A Swedish Institute scholarship for master's studies in Sweden, covering full tuition, a monthly living allowance, and a travel grant for selected global professionals. The provider lists 34 eligible countries, including Uzbekistan, and publishes the full list on its official page.",
    source: "siScholarship",
    requirements: [
      {
        kind: "ACADEMIC",
        summary: "The scholarship applies to master's level studies.",
      },
      {
        kind: "WORK_EXPERIENCE",
        summary:
          "Work and leadership experience are part of the Swedish Institute's eligibility criteria.",
      },
      {
        kind: "OTHER",
        summary:
          "Applicants must meet all eligibility criteria published by the Swedish Institute, including its work and leadership experience requirements.",
      },
    ],
    deadlines: [
      {
        cycle: "2027–28 application round",
        applicantGroup: "All applicants",
        opensOn: "2026-10-16",
        deadlineOn: "2027-01-15",
        note: null,
      },
      {
        cycle: "Eligibility check",
        applicantGroup: "All applicants",
        opensOn: "2027-02-08",
        deadlineOn: "2027-02-24",
        note: null,
      },
      {
        cycle: "Other key dates",
        applicantGroup: "All applicants",
        note: "The Swedish Institute also lists 1 April 2027 and 22 April 2027 as key dates in the application process.",
      },
    ],
  },
  {
    slug: "erasmus-mundus-joint-masters-scholarships",
    name: "Erasmus Mundus Joint Masters Scholarships",
    providerName: "European Commission (Erasmus+)",
    providerUrl: "https://erasmus-plus.ec.europa.eu/",
    // The programme spans multiple European countries; no single host country
    // is recorded.
    hostCountryCode: null,
    fundingType: "FULLY_FUNDED",
    degreeLevels: ["MASTER"],
    nationalityScope: "ALL",
    eligibleNationalities: [],
    fieldScope: "ALL",
    fields: [],
    summary:
      "Erasmus Mundus Joint Masters are integrated study programmes delivered by consortia of European universities. The best-ranked applicants receive a full scholarship covering participation costs, travel and visa costs, and a living allowance.",
    source: "erasmusMundus",
    requirements: [
      {
        kind: "ACADEMIC",
        summary: "A bachelor's degree is required.",
      },
      {
        kind: "DOCUMENT",
        summary:
          "Applications are made to individual Erasmus Mundus joint master consortia, each with its own requirements and deadlines.",
      },
    ],
    deadlines: [
      {
        cycle: "Most consortia",
        applicantGroup: "All applicants",
        note: "Most applications open between October and January; each consortium sets its own exact dates.",
      },
    ],
  },
];
