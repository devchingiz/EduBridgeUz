import { describe, expect, it } from "vitest";

import {
  describeUserAgent,
  firstName,
  formatBudget,
  formatDate,
  relativeTime,
} from "@/lib/format";

describe("firstName", () => {
  it("returns the first word and tolerates extra spacing", () => {
    expect(firstName("Amina Karimova")).toBe("Amina");
    expect(firstName("  Timur   Aliyev ")).toBe("Timur");
    expect(firstName("Madonna")).toBe("Madonna");
  });
});

describe("formatDate", () => {
  it("formats valid dates and labels missing or invalid values", () => {
    expect(formatDate(new Date("2026-11-13T00:00:00.000Z"))).toContain("2026");
    expect(formatDate(null)).toBe("Not set");
    expect(formatDate("not-a-date")).toBe("Not set");
  });
});

describe("formatBudget", () => {
  it("formats a whole budget with its currency", () => {
    const formatted = formatBudget(12_000, "USD");
    expect(formatted).toContain("12,000");
    expect(formatted).toContain("$");
  });

  it("returns a placeholder when either part is missing", () => {
    expect(formatBudget(null, "USD")).toBe("Not set");
    expect(formatBudget(12_000, null)).toBe("Not set");
  });

  it("falls back for currencies Intl does not know", () => {
    expect(formatBudget(1_000, "NOTACURRENCY")).toBe("1,000 NOTACURRENCY");
  });
});

describe("describeUserAgent", () => {
  it("recognises common browser and platform pairs", () => {
    expect(
      describeUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36",
      ),
    ).toBe("Chrome on Windows");
    expect(
      describeUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36 Edg/140.0",
      ),
    ).toBe("Edge on Windows");
    expect(
      describeUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15",
      ),
    ).toBe("Safari on macOS");
    expect(describeUserAgent(null)).toBe("Unknown device");
  });
});

describe("relativeTime", () => {
  it("describes recent activity in human units", () => {
    expect(relativeTime(new Date(Date.now() - 10_000))).toBe("just now");
    expect(relativeTime(new Date(Date.now() - 5 * 60_000))).toBe("5 min ago");
    expect(relativeTime(new Date(Date.now() - 3 * 60 * 60_000))).toBe(
      "3 hr ago",
    );
    expect(relativeTime(new Date(Date.now() - 2 * 24 * 60 * 60_000))).toBe(
      "2 days ago",
    );
  });
});
