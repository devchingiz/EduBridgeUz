/**
 * Transparent, deterministic shortlist bucketing for the AI advisor.
 *
 * These categories are PLANNING ESTIMATES derived only from catalog facts that
 * EduBridge actually stores. They are not admission predictions: the catalog
 * does not contain acceptance rates, test-score thresholds, or any other
 * selectivity data, so the output must always be shown with an explicit
 * "estimate, not a guarantee" disclosure.
 */

export type ReachCategory = "Reach" | "Target" | "Likely";

export type ClassificationInput = {
  /** QS 2027 rank position. Lower is a more prominent band. Null = unranked. */
  rankPosition: number | null;
  /** Exact published QS string, preserving ties and ranges. */
  rankDisplay: string | null;
  /** Lowest annual tuition found in the catalog, in minor units. */
  annualTuitionMinor: number | null;
  tuitionCurrency: string | null;
  /** Student's budget in major units, or null when not provided. */
  budgetMajor: number | null;
  budgetCurrency: string | null;
  /** Whether the catalog offers the student's target degree and field. */
  offersTargetDegree: boolean;
  offersField: boolean;
};

export type ClassificationResult = {
  category: ReachCategory;
  /** Plain-language reason grounded only in the supplied facts. */
  reason: string;
  /** True when the student's budget could not be compared to tuition. */
  budgetComparable: boolean;
  /** Facts that are missing and would change the estimate if known. */
  missingFacts: string[];
};

const REACH_RANK = 100;
const TARGET_RANK = 300;

function rankBand(
  input: Pick<ClassificationInput, "rankPosition" | "rankDisplay">,
): {
  label: string;
  category: ReachCategory;
} {
  if (input.rankPosition === null) {
    return { label: "no QS 2027 rank in the catalog", category: "Likely" };
  }
  // Use the exact published string so ties and ranges are preserved verbatim.
  const published = input.rankDisplay ?? String(input.rankPosition);
  if (input.rankPosition <= REACH_RANK) {
    return {
      label: `QS 2027 rank ${published} (top ${REACH_RANK} band)`,
      category: "Reach",
    };
  }
  if (input.rankPosition <= TARGET_RANK) {
    return {
      label: `QS 2027 rank ${published} (${REACH_RANK + 1}–${TARGET_RANK} band)`,
      category: "Target",
    };
  }
  return {
    label: `QS 2027 rank ${published} (outside top ${TARGET_RANK})`,
    category: "Likely",
  };
}

/** Converts minor units to major units only when the currency digits are known. */
const CURRENCY_DIGITS: Record<string, number> = {
  EUR: 2,
  USD: 2,
  GBP: 2,
  SEK: 2,
  CAD: 2,
  AUD: 2,
  CHF: 2,
  JPY: 0,
  CNY: 2,
  KRW: 0,
  INR: 2,
};

export function classifyUniversity(
  input: ClassificationInput,
): ClassificationResult {
  const band = rankBand(input);
  const missingFacts: string[] = [];

  const tuitionMajor =
    input.annualTuitionMinor === null
      ? null
      : input.annualTuitionMinor /
        10 ** (CURRENCY_DIGITS[input.tuitionCurrency ?? ""] ?? 2);
  const budgetComparable =
    tuitionMajor !== null &&
    input.budgetMajor !== null &&
    input.tuitionCurrency !== null &&
    input.budgetCurrency === input.tuitionCurrency;

  let category = band.category;
  const reasons = [band.label];

  if (input.annualTuitionMinor === null) {
    missingFacts.push("annual tuition");
  } else if (!budgetComparable) {
    missingFacts.push("a comparable tuition and budget currency");
  } else if (tuitionMajor !== null && input.budgetMajor !== null) {
    if (tuitionMajor > input.budgetMajor) {
      // Over-budget options are harder to plan for, so nudge one band upward.
      category =
        category === "Likely"
          ? "Target"
          : category === "Target"
            ? "Reach"
            : "Reach";
      reasons.push("indicative annual tuition is above the saved budget");
    } else {
      reasons.push("indicative annual tuition is within the saved budget");
    }
  }

  if (!input.offersTargetDegree) {
    missingFacts.push("a matching target degree");
  }
  if (!input.offersField) {
    missingFacts.push("a matching field of study");
  }

  return {
    category,
    reason: reasons.join("; "),
    budgetComparable,
    missingFacts,
  };
}

export const CLASSIFICATION_DISCLOSURE =
  "Reach / Target / Likely are planning estimates based only on QS 2027 rank bands " +
  "and the budget, degree and field facts stored in EduBridge. They are not " +
  "admission predictions or guarantees: the catalog does not include acceptance " +
  "rates or entry requirements. Confirm selectivity on each university's official site.";
