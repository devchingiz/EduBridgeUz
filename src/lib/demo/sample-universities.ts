export const DEGREE_LEVELS = ["Bachelor", "Master", "PhD"] as const;
export const STUDY_FIELDS = [
  "Computer Science",
  "Engineering",
  "Business",
  "Economics",
  "Natural Sciences",
  "Social Sciences",
  "Humanities",
  "Life Sciences",
  "Medicine",
] as const;

export type DegreeLevel = (typeof DEGREE_LEVELS)[number];
export type StudyField = (typeof STUDY_FIELDS)[number];

export type UniversityTone =
  "indigo" | "blue" | "sky" | "emerald" | "amber" | "violet" | "cyan" | "rose";

export type SampleUniversity = {
  id: string;
  name: string;
  shortName: string;
  city: string;
  country: string;
  type: "Public" | "Private";
  degrees: readonly DegreeLevel[];
  fields: readonly StudyField[];
  website: string;
  initials: string;
  tone: UniversityTone;
};

/**
 * These are deliberately minimal, hand-checked profiles used to preview the
 * discovery interface on the marketing site. They contain no tuition,
 * ranking, deadline, or admission-requirement claims. The live catalog is
 * populated separately from official sources with verification metadata.
 */
export const sampleUniversities: readonly SampleUniversity[] = [
  {
    id: "university-of-toronto",
    name: "University of Toronto",
    shortName: "Toronto",
    city: "Toronto",
    country: "Canada",
    type: "Public",
    degrees: ["Bachelor", "Master", "PhD"],
    fields: ["Computer Science", "Engineering", "Business", "Life Sciences"],
    website: "https://www.toronto.edu",
    initials: "UofT",
    tone: "indigo",
  },
  {
    id: "kaist",
    name: "KAIST",
    shortName: "KAIST",
    city: "Daejeon",
    country: "South Korea",
    type: "Public",
    degrees: ["Bachelor", "Master", "PhD"],
    fields: ["Computer Science", "Engineering", "Natural Sciences"],
    website: "https://www.kaist.ac.kr/en/",
    initials: "K",
    tone: "blue",
  },
  {
    id: "technical-university-of-munich",
    name: "Technical University of Munich",
    shortName: "TUM",
    city: "Munich",
    country: "Germany",
    type: "Public",
    degrees: ["Bachelor", "Master", "PhD"],
    fields: [
      "Computer Science",
      "Engineering",
      "Natural Sciences",
      "Economics",
    ],
    website: "https://www.tum.de/en/",
    initials: "TUM",
    tone: "sky",
  },
  {
    id: "university-of-amsterdam",
    name: "University of Amsterdam",
    shortName: "UvA",
    city: "Amsterdam",
    country: "Netherlands",
    type: "Public",
    degrees: ["Bachelor", "Master", "PhD"],
    fields: [
      "Computer Science",
      "Business",
      "Economics",
      "Social Sciences",
      "Humanities",
    ],
    website: "https://www.uva.nl/en",
    initials: "UvA",
    tone: "rose",
  },
  {
    id: "national-university-of-singapore",
    name: "National University of Singapore",
    shortName: "NUS",
    city: "Singapore",
    country: "Singapore",
    type: "Public",
    degrees: ["Bachelor", "Master", "PhD"],
    fields: [
      "Computer Science",
      "Engineering",
      "Business",
      "Medicine",
      "Life Sciences",
    ],
    website: "https://www.nus.edu.sg",
    initials: "NUS",
    tone: "emerald",
  },
  {
    id: "university-of-manchester",
    name: "University of Manchester",
    shortName: "Manchester",
    city: "Manchester",
    country: "United Kingdom",
    type: "Public",
    degrees: ["Bachelor", "Master", "PhD"],
    fields: [
      "Computer Science",
      "Engineering",
      "Business",
      "Humanities",
      "Social Sciences",
    ],
    website: "https://www.manchester.ac.uk",
    initials: "UoM",
    tone: "amber",
  },
  {
    id: "bocconi-university",
    name: "Bocconi University",
    shortName: "Bocconi",
    city: "Milan",
    country: "Italy",
    type: "Private",
    degrees: ["Bachelor", "Master", "PhD"],
    fields: ["Business", "Economics", "Social Sciences"],
    website: "https://www.unibocconi.it/en",
    initials: "B",
    tone: "violet",
  },
  {
    id: "lund-university",
    name: "Lund University",
    shortName: "Lund",
    city: "Lund",
    country: "Sweden",
    type: "Public",
    degrees: ["Bachelor", "Master", "PhD"],
    fields: [
      "Engineering",
      "Natural Sciences",
      "Business",
      "Economics",
      "Social Sciences",
    ],
    website: "https://www.lunduniversity.lu.se",
    initials: "LU",
    tone: "cyan",
  },
];

export const sampleCountries = Array.from(
  new Set(sampleUniversities.map((university) => university.country)),
).sort();
