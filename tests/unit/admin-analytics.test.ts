import { describe, expect, it } from "vitest";

import {
  applicationStatusBreakdown,
  buildTrend,
  dayKey,
  sliceTrend,
  TREND_DAYS,
  universityStatusBreakdown,
} from "@/lib/admin/analytics";
import { VERIFICATION_STATUSES } from "@/lib/catalog/constants";
import { APPLICATION_STATUSES } from "@/lib/workspace/constants";

const NOW = new Date("2026-11-21T15:30:00Z");

function emptyValues() {
  return {
    accounts: [] as Date[],
    applications: [] as Date[],
    auditEvents: [] as Date[],
    advisorRequests: [] as Date[],
  };
}

describe("administration analytics", () => {
  it("builds a continuous UTC daily series and buckets only real timestamps", () => {
    const values = {
      ...emptyValues(),
      accounts: [
        new Date("2026-11-21T09:00:00Z"),
        new Date("2026-11-19T23:30:00Z"),
        new Date("2026-08-23T12:00:00Z"),
        new Date("2026-11-22T01:00:00Z"),
      ],
      applications: [new Date("2026-11-20T08:00:00Z")],
      auditEvents: [
        new Date("2026-11-21T07:00:00Z"),
        new Date("2026-11-21T18:00:00Z"),
      ],
      advisorRequests: [new Date("2026-11-18T11:00:00Z")],
    };

    const trend = buildTrend(values, NOW);

    expect(trend).toHaveLength(TREND_DAYS);
    expect(trend[0]?.date).toBe("2026-08-24");
    expect(trend.at(-1)?.date).toBe("2026-11-21");
    expect(trend.at(-1)).toMatchObject({
      accounts: 1,
      // The 18:00 event is after NOW and must not be counted.
      auditEvents: 1,
      label: "Nov 21",
    });
    expect(trend.at(-2)).toMatchObject({ date: "2026-11-20", applications: 1 });
    expect(trend.at(-3)).toMatchObject({ date: "2026-11-19", accounts: 1 });
    expect(trend.at(-4)).toMatchObject({
      date: "2026-11-18",
      advisorRequests: 1,
    });
    expect(trend[0]).toMatchObject({
      accounts: 0,
      applications: 0,
      auditEvents: 0,
      advisorRequests: 0,
    });
  });

  it("uses UTC calendar keys regardless of local timezone", () => {
    expect(dayKey(new Date("2026-11-21T23:59:59Z"))).toBe("2026-11-21");
    expect(dayKey(new Date("2026-11-22T00:00:00Z"))).toBe("2026-11-22");
  });

  it("slices only the requested number of real days", () => {
    const trend = buildTrend(emptyValues(), NOW, 30);
    const week = sliceTrend(trend, 7);

    expect(week).toHaveLength(7);
    expect(week[0]?.date).toBe("2026-11-15");
    expect(week.at(-1)?.date).toBe("2026-11-21");
    expect(sliceTrend(trend, 0)).toEqual([]);
  });

  it("zero-fills every status and keeps human-readable labels", () => {
    const universities = universityStatusBreakdown({
      VERIFIED: 3,
      ARCHIVED: 1,
    });
    const applications = applicationStatusBreakdown({ SUBMITTED: 2 });

    expect(universities).toHaveLength(VERIFICATION_STATUSES.length);
    expect(universities[0]).toEqual({
      status: "VERIFIED",
      label: "Verified",
      count: 3,
    });
    expect(universities.find((item) => item.status === "ARCHIVED")?.count).toBe(
      1,
    );
    expect(
      universities.find((item) => item.status === "NEEDS_REVIEW")?.count,
    ).toBe(0);

    expect(applications).toHaveLength(APPLICATION_STATUSES.length);
    expect(applications.find((item) => item.status === "SUBMITTED")).toEqual({
      status: "SUBMITTED",
      label: "Submitted",
      count: 2,
    });
  });
});
