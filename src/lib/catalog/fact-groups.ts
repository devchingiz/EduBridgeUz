import type { FieldVerificationStatusValue } from "@/lib/catalog/constants";
import { plainText } from "@/lib/catalog/format";

type FactLike = {
  value: string | null;
  status: FieldVerificationStatusValue;
  note?: string | null;
};

const UNAVAILABLE_PATTERNS = [
  "information unavailable",
  "not available",
  "not classified",
  "not published",
  "not set",
  "not specified",
  "unavailable",
];

/** Detects placeholder wording that should never be shown as a fact. */
export function isUnavailableText(value: string | null | undefined): boolean {
  const text = plainText(value);
  if (!text) return false;
  const normalized = text.toLowerCase();
  return UNAVAILABLE_PATTERNS.some((pattern) => normalized.includes(pattern));
}

/** Returns readable display text, or null when the text is a placeholder. */
export function availableText(value: string | null | undefined): string | null {
  const text = plainText(value);
  return text && !isUnavailableText(text) ? text : null;
}

function hasUsableValue(fact: FactLike): boolean {
  return Boolean(availableText(fact.value) && !isUnavailableText(fact.note));
}

/** A fact is displayable only when it has a value and a usable source status. */
export function isAvailableFieldFact(fact: FactLike): boolean {
  return (
    hasUsableValue(fact) &&
    (fact.status === "VERIFIED" || fact.status === "PARTIALLY_VERIFIED")
  );
}

/** Keep only facts that can be rendered as sourced, usable values. */
export function filterAvailableFacts<T extends FactLike>(facts: T[]): T[] {
  return facts.filter((fact) => isAvailableFieldFact(fact));
}

export function hasAvailableFacts<T extends FactLike>(facts: T[]): boolean {
  return facts.some((fact) => isAvailableFieldFact(fact));
}

/** Split sourced facts into what can be shown confidently and what cannot. */
export function groupFieldFacts<T extends FactLike>(
  facts: T[],
): {
  confirmed: T[];
  unconfirmed: T[];
} {
  return {
    confirmed: filterAvailableFacts(facts),
    unconfirmed: facts.filter((fact) => !isAvailableFieldFact(fact)),
  };
}
