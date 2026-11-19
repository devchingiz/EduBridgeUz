/**
 * Pure mapping and validation helpers for the cached QS 2027 research dataset.
 *
 * These functions are intentionally free of Prisma, network, and Next.js
 * dependencies so they can be unit tested and reused by the offline importer.
 */

export type QsProgramLike = {
  name: string;
  degree: string | null;
  studyLevel: string | null;
  duration: string | null;
  fee: string | null;
  sourceUrl: string;
};

export type QsUniversityLike = {
  qsNid: number;
  name: string;
  slug: string;
  rankPosition: number;
  qsSourceUrl: string;
};

export type QsDatasetLike = {
  meta?: { retrievedAt?: string; [key: string]: unknown } | null;
  universities: QsUniversityLike[];
};

export type ImportedDegreeLevel =
  "BACHELOR" | "MASTER" | "PHD" | "DIPLOMA" | "CERTIFICATE";

export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

/** Legacy slugs omit a leading article, for example the seed Manchester record. */
export function legacySeedSlug(slug: string): string {
  return slug.replace(/^the-/, "");
}

export function validateQsDataset(
  dataset: QsDatasetLike | null | undefined,
  expectedCount = 500,
): void {
  if (!dataset?.meta || !Array.isArray(dataset.universities)) {
    throw new Error("Dataset is missing meta or universities.");
  }
  if (dataset.universities.length !== expectedCount) {
    throw new Error(
      `Expected ${expectedCount} universities, found ${dataset.universities.length}.`,
    );
  }

  const names = new Set<string>();
  const nids = new Set<number>();
  const slugs = new Set<string>();
  for (const university of dataset.universities) {
    if (!university.name || names.has(university.name)) {
      throw new Error(
        `Duplicate or missing university name: ${university.name}`,
      );
    }
    if (!Number.isInteger(university.qsNid) || nids.has(university.qsNid)) {
      throw new Error(`Duplicate or missing QS nid: ${university.qsNid}`);
    }
    if (!university.slug || slugs.has(university.slug)) {
      throw new Error(`Duplicate or missing slug: ${university.slug}`);
    }
    if (!Number.isInteger(university.rankPosition)) {
      throw new Error(`Invalid QS rank for ${university.name}.`);
    }
    if (!isHttpUrl(university.qsSourceUrl)) {
      throw new Error(`Invalid QS source URL for ${university.name}.`);
    }
    names.add(university.name);
    nids.add(university.qsNid);
    slugs.add(university.slug);
  }
}

export function degreeLevel(
  program: QsProgramLike,
): ImportedDegreeLevel | null {
  const level = program.studyLevel?.trim().toLowerCase();
  if (level === "bachelors" || level === "bachelor") return "BACHELOR";
  if (level === "phd" || level === "doctorate") return "PHD";
  if (level === "mba") return "MASTER";

  const degree = (program.degree ?? "").trim();
  if (/^(phd|doctor)/i.test(degree)) return "PHD";
  if (/^(bsc|ba|bs|beng|llb|bba|bed|bcomm|bbus|bmus|bfa|msci)/i.test(degree)) {
    return "BACHELOR";
  }
  if (
    /^(msc|ma|mba|meng|mphil|mres|mph|med|mla|mps|mcomm|mfa|llm)/i.test(degree)
  ) {
    return "MASTER";
  }
  // DIPLOMA and CERTIFICATE are valid app values but QS does not identify
  // them reliably in the cached programme index, so they are never inferred.
  return null;
}

export function programmeField(name: string): string {
  const value = name.toLowerCase();
  const rules: Array<[string, RegExp]> = [
    ["Computer Science", /\b(computer science|computing)\b/],
    [
      "Artificial Intelligence",
      /\b(artificial intelligence|machine learning)\b/,
    ],
    ["Cybersecurity", /\b(cyber ?security|information security)\b/],
    ["Data Science", /\b(data science|big data|analytics)\b/],
    ["Engineering", /\b(engineer|engineering)\b/],
    ["Business", /\b(business|management|accounting|finance|marketing|mba)\b/],
    ["Medicine", /\b(medicine|medical|clinical|public health)\b/],
    ["Law", /\b(law|legal)\b/],
    ["Education", /\b(education|teaching)\b/],
    [
      "Natural Sciences",
      /\b(physics|chemistry|biology|mathematics|statistics)\b/,
    ],
    [
      "Social Sciences",
      /\b(economics|sociology|psychology|political|social)\b/,
    ],
    [
      "Arts & Humanities",
      /\b(art|history|philosophy|literature|humanities|music)\b/,
    ],
  ];
  return (
    rules.find(([, pattern]) => pattern.test(value))?.[0] ?? "Not classified"
  );
}

export function durationMonths(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/(\d+)\s*(month|year)/i);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return /year/i.test(match[2]) ? amount * 12 : amount;
}

export function feeCurrency(value: string | null): string | null {
  if (!value) return null;
  return value.match(/\b([A-Z]{3})\b/)?.[1] ?? null;
}
