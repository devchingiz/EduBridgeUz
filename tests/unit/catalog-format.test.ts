import { describe, expect, it } from "vitest";

import {
  deadlineState,
  formatCheckedOn,
  formatDeadlineLabel,
  formatDeadlineWindow,
  formatMonthDay,
  formatMoney,
  formatStart,
  verificationBadgeVariant,
} from "@/lib/catalog/format";

describe("formatMoney", () => {
  it("formats a whole-unit amount without decimals", () => {
    expect(formatMoney(600000, "EUR")).toBe("€6,000");
  });

  it("keeps cents when the amount is not a whole unit", () => {
    expect(formatMoney(600050, "EUR")).toBe("€6,000.50");
  });

  it("falls back to the raw amount for an invalid currency", () => {
    expect(formatMoney(123400, "EURO")).toBe("1,234 EURO");
  });
});

describe("formatMonthDay", () => {
  it("expands a recurring month-day without inventing a year", () => {
    expect(formatMonthDay("02-01")).toBe("1 February");
    expect(formatMonthDay("05-31")).toBe("31 May");
  });

  it("returns null for missing or invalid input", () => {
    expect(formatMonthDay(null)).toBeNull();
    expect(formatMonthDay("13-01")).toBeNull();
  });
});

describe("formatDeadlineLabel", () => {
  it("renders an exact date with its year", () => {
    expect(
      formatDeadlineLabel({
        deadlineOn: "2027-01-15",
        deadlineMonthDay: null,
        note: null,
      }),
    ).toBe("Jan 15, 2027");
  });

  it("marks a recurring date as annual", () => {
    expect(
      formatDeadlineLabel({
        deadlineOn: null,
        deadlineMonthDay: "05-31",
        note: null,
      }),
    ).toBe("31 May (annual)");
  });

  it("points to the note when no date is published", () => {
    expect(
      formatDeadlineLabel({
        deadlineOn: null,
        deadlineMonthDay: null,
        note: "Dates published each autumn.",
      }),
    ).toBe("See note");
  });

  it("reports an unknown deadline without guessing", () => {
    expect(
      formatDeadlineLabel({
        deadlineOn: null,
        deadlineMonthDay: null,
        note: null,
      }),
    ).toBe("Not published");
  });
});

describe("formatDeadlineWindow", () => {
  it("joins a recurring opening and closing date", () => {
    expect(
      formatDeadlineWindow({
        opensOn: null,
        deadlineOn: null,
        opensMonthDay: "10-01",
        deadlineMonthDay: "01-15",
      }),
    ).toBe("1 October – 15 January");
  });

  it("returns null when neither end is known", () => {
    expect(
      formatDeadlineWindow({
        opensOn: null,
        deadlineOn: null,
        opensMonthDay: null,
        deadlineMonthDay: null,
      }),
    ).toBeNull();
  });
});

describe("formatStart", () => {
  it("prefers the provider's own wording", () => {
    expect(formatStart([10], "Winter and summer semester")).toBe(
      "Winter and summer semester",
    );
  });

  it("expands month numbers when no wording exists", () => {
    expect(formatStart([10, 4], null)).toBe("October, April");
  });

  it("returns null when nothing is known", () => {
    expect(formatStart([], null)).toBeNull();
  });
});

describe("deadlineState", () => {
  const now = new Date("2026-11-16T00:00:00Z");

  it("reports an exact deadline in the past as closed", () => {
    expect(
      deadlineState(
        {
          opensOn: null,
          deadlineOn: "2026-01-15",
          opensMonthDay: null,
          deadlineMonthDay: null,
        },
        now,
      ),
    ).toBe("closed");
  });

  it("reports an exact deadline before its opening date as upcoming", () => {
    expect(
      deadlineState(
        {
          opensOn: "2026-12-01",
          deadlineOn: "2027-01-15",
          opensMonthDay: null,
          deadlineMonthDay: null,
        },
        now,
      ),
    ).toBe("upcoming");
  });

  it("reports a recurring window that crosses the new year as open", () => {
    expect(
      deadlineState(
        {
          opensOn: null,
          deadlineOn: null,
          opensMonthDay: "10-01",
          deadlineMonthDay: "01-15",
        },
        now,
      ),
    ).toBe("open");
  });

  it("reports a recurring window that already closed", () => {
    expect(
      deadlineState(
        {
          opensOn: null,
          deadlineOn: null,
          opensMonthDay: "02-01",
          deadlineMonthDay: "05-31",
        },
        now,
      ),
    ).toBe("closed");
  });

  it("reports unknown when no date is stored", () => {
    expect(
      deadlineState(
        {
          opensOn: null,
          deadlineOn: null,
          opensMonthDay: null,
          deadlineMonthDay: null,
        },
        now,
      ),
    ).toBe("unknown");
  });
});

describe("verificationBadgeVariant", () => {
  it("maps each status to a distinct badge tone", () => {
    expect(verificationBadgeVariant("VERIFIED")).toBe("success");
    expect(verificationBadgeVariant("NEEDS_REVIEW")).toBe("warning");
    expect(verificationBadgeVariant("UNVERIFIED")).toBe("outline");
    expect(verificationBadgeVariant("EXPIRED")).toBe("muted");
    expect(verificationBadgeVariant("ARCHIVED")).toBe("muted");
  });
});

describe("formatCheckedOn", () => {
  it("formats a verification date", () => {
    expect(formatCheckedOn("2026-11-12")).toBe("Checked Nov 12, 2026");
  });

  it("states when a fact was never checked", () => {
    expect(formatCheckedOn(null)).toBe("Not yet verified");
  });
});
