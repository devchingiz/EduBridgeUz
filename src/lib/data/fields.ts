/** Broad fields of study used by the profile and, later, catalog filters. */

export const STUDY_FIELDS = [
  "Agriculture & Environment",
  "Architecture & Design",
  "Arts & Humanities",
  "Business & Management",
  "Computer Science",
  "Economics & Finance",
  "Education",
  "Engineering",
  "Health & Medicine",
  "Hospitality & Tourism",
  "International Relations",
  "Journalism & Media",
  "Law",
  "Mathematics & Statistics",
  "Natural Sciences",
  "Performing Arts",
  "Social Sciences",
  "Sports Science",
  "Technology & Data",
  "Other",
] as const;

export type StudyField = (typeof STUDY_FIELDS)[number];

export function isStudyField(value: string): value is StudyField {
  return (STUDY_FIELDS as readonly string[]).includes(value);
}

export const DEGREE_LEVELS = [
  { value: "BACHELOR", label: "Bachelor's" },
  { value: "MASTER", label: "Master's" },
  { value: "PHD", label: "PhD" },
  { value: "DIPLOMA", label: "Diploma" },
  { value: "CERTIFICATE", label: "Certificate" },
] as const;

export type DegreeLevelValue = (typeof DEGREE_LEVELS)[number]["value"];

export function degreeLabel(value: string | null | undefined): string {
  return DEGREE_LEVELS.find((item) => item.value === value)?.label ?? "Not set";
}

export const ENGLISH_TESTS = [
  { value: "IELTS", label: "IELTS" },
  { value: "TOEFL", label: "TOEFL" },
  { value: "PTE", label: "PTE Academic" },
  { value: "DUOLINGO", label: "Duolingo English Test" },
  { value: "CAMBRIDGE", label: "Cambridge English" },
  { value: "OTHER", label: "Other" },
  { value: "NONE", label: "Not taken yet" },
] as const;

export const BUDGET_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "UZS",
  "KZT",
  "RUB",
] as const;
