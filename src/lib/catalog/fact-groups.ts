import type { FieldVerificationStatusValue } from "@/lib/catalog/constants";

type FactLike = {
  value: string | null;
  status: FieldVerificationStatusValue;
};

function hasUsableValue(fact: FactLike): boolean {
  return Boolean(fact.value && fact.value.trim().length > 0);
}

function isConfirmed(fact: FactLike): boolean {
  return (
    hasUsableValue(fact) &&
    (fact.status === "VERIFIED" || fact.status === "PARTIALLY_VERIFIED")
  );
}

/** Split sourced facts into what can be shown confidently and what cannot. */
export function groupFieldFacts<T extends FactLike>(
  facts: T[],
): {
  confirmed: T[];
  unconfirmed: T[];
} {
  return {
    confirmed: facts.filter(isConfirmed),
    unconfirmed: facts.filter((fact) => !isConfirmed(fact)),
  };
}
