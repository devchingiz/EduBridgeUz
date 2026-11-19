/**
 * Age rules are pure functions so they can be unit tested without a database
 * and reused by both the registration flow and the workspace gate.
 */

export const MINIMUM_AGE = 13;
export const ADULT_AGE = 18;

/** Parses an ISO `YYYY-MM-DD` date as a calendar date in UTC. */
export function parseDateOfBirth(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

export function ageOn(dateOfBirth: Date, now: Date = new Date()): number {
  let age = now.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const month = now.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (
    month < 0 ||
    (month === 0 && now.getUTCDate() < dateOfBirth.getUTCDate())
  ) {
    age -= 1;
  }
  return age;
}

export function isAdult(dateOfBirth: Date, now: Date = new Date()): boolean {
  return ageOn(dateOfBirth, now) >= ADULT_AGE;
}

export function isMinor(dateOfBirth: Date, now: Date = new Date()): boolean {
  return ageOn(dateOfBirth, now) < ADULT_AGE;
}

export type AgeGateResult =
  | { status: "adult" }
  | { status: "minor"; guardianRequired: true }
  | { status: "too_young"; minimumAge: number }
  | { status: "invalid" };

export function evaluateAgeGate(
  dateOfBirth: Date,
  now: Date = new Date(),
): AgeGateResult {
  if (Number.isNaN(dateOfBirth.getTime())) return { status: "invalid" };
  if (dateOfBirth > now) return { status: "invalid" };

  const age = ageOn(dateOfBirth, now);
  if (age < MINIMUM_AGE)
    return { status: "too_young", minimumAge: MINIMUM_AGE };
  if (age < ADULT_AGE) return { status: "minor", guardianRequired: true };
  return { status: "adult" };
}

/** Formats a date as `YYYY-MM-DD` for date inputs and `<time>` elements. */
export function toDateInputValue(date: Date | null | undefined): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}
