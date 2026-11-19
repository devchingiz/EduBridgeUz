import { describe, expect, it } from "vitest";

import {
  ADULT_AGE,
  MINIMUM_AGE,
  ageOn,
  evaluateAgeGate,
  isAdult,
  isMinor,
  parseDateOfBirth,
} from "@/lib/auth/age";

const NOW = new Date("2026-11-13T12:00:00.000Z");

describe("parseDateOfBirth", () => {
  it("parses a valid ISO calendar date", () => {
    expect(parseDateOfBirth("2008-02-29")?.toISOString()).toBe(
      "2008-02-29T00:00:00.000Z",
    );
  });

  it("rejects malformed, impossible, and non-ISO values", () => {
    expect(parseDateOfBirth("2008-2-9")).toBeNull();
    expect(parseDateOfBirth("2008-02-30")).toBeNull();
    expect(parseDateOfBirth("13/11/2008")).toBeNull();
    expect(parseDateOfBirth("")).toBeNull();
  });
});

describe("ageOn", () => {
  it("counts a birthday as reached on the day itself", () => {
    expect(ageOn(new Date("2008-11-13T00:00:00.000Z"), NOW)).toBe(18);
  });

  it("does not count the birthday the day before", () => {
    expect(ageOn(new Date("2008-11-14T00:00:00.000Z"), NOW)).toBe(17);
  });

  it("handles leap-day births in non-leap years", () => {
    expect(ageOn(new Date("2008-02-29T00:00:00.000Z"), NOW)).toBe(18);
  });
});

describe("evaluateAgeGate", () => {
  it("rejects future dates", () => {
    expect(evaluateAgeGate(new Date("2030-01-01T00:00:00.000Z"), NOW)).toEqual({
      status: "invalid",
    });
  });

  it("rejects students below the minimum age", () => {
    expect(evaluateAgeGate(new Date("2015-01-01T00:00:00.000Z"), NOW)).toEqual({
      status: "too_young",
      minimumAge: MINIMUM_AGE,
    });
  });

  it("accepts a student exactly at the minimum age", () => {
    const dob = new Date(
      Date.UTC(
        NOW.getUTCFullYear() - MINIMUM_AGE,
        NOW.getUTCMonth(),
        NOW.getUTCDate(),
      ),
    );
    expect(evaluateAgeGate(dob, NOW)).toEqual({
      status: "minor",
      guardianRequired: true,
    });
  });

  it("marks under-18 students as minors and 18+ as adults", () => {
    expect(evaluateAgeGate(new Date("2009-01-01T00:00:00.000Z"), NOW)).toEqual({
      status: "minor",
      guardianRequired: true,
    });
    expect(evaluateAgeGate(new Date("2007-01-01T00:00:00.000Z"), NOW)).toEqual({
      status: "adult",
    });
  });
});

describe("isMinor and isAdult", () => {
  it("splits exactly at the adult age", () => {
    const justUnder = new Date("2008-11-14T00:00:00.000Z");
    const exactly = new Date("2008-11-13T00:00:00.000Z");

    expect(isMinor(justUnder, NOW)).toBe(true);
    expect(isAdult(justUnder, NOW)).toBe(false);
    expect(isMinor(exactly, NOW)).toBe(false);
    expect(isAdult(exactly, NOW)).toBe(true);
    expect(ADULT_AGE).toBe(18);
  });
});
