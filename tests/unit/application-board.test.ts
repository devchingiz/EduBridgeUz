import { describe, expect, it } from "vitest";

import {
  buildApplicationBoard,
  deadlineDistanceLabel,
  filterApplications,
  getApplicationMetrics,
  getAttentionApplications,
  getDeadlineUrgency,
  getDocumentReadiness,
  parseApplicationFilters,
  sortApplications,
  type ApplicationBoardRow,
} from "@/lib/workspace/application-board";

const NOW = new Date("2026-11-19T12:00:00.000Z");

function daysFromNow(days: number): Date {
  return new Date(Date.UTC(2026, 10, 19 + days));
}

function row(
  overrides: Partial<ApplicationBoardRow> & { id: string },
): ApplicationBoardRow {
  return {
    status: "INTERESTED",
    progress: 10,
    deadline: null,
    updatedAt: new Date("2026-11-10T00:00:00.000Z"),
    notes: "",
    university: {
      name: "Example University",
      city: "Berlin",
      countryCode: "DE",
    },
    documents: [],
    ...overrides,
  };
}

describe("parseApplicationFilters", () => {
  it("returns defaults for empty or invalid values", () => {
    expect(
      parseApplicationFilters({
        q: "",
        status: "bogus",
        urgency: "bogus",
        sort: "bogus",
      }),
    ).toEqual({
      query: "",
      status: "ALL",
      urgency: "all",
      sort: "deadline",
    });
  });

  it("parses supported filters and trims the search query", () => {
    expect(
      parseApplicationFilters({
        q: "  Berlin  ",
        status: "submitted",
        urgency: "next-7-days",
        sort: "updated",
      }),
    ).toEqual({
      query: "Berlin",
      status: "SUBMITTED",
      urgency: "next-7-days",
      sort: "updated",
    });
  });
});

describe("getDeadlineUrgency", () => {
  it("classifies active deadlines by distance from today", () => {
    expect(getDeadlineUrgency(daysFromNow(-1), "SUBMITTED", NOW)).toBe(
      "overdue",
    );
    expect(getDeadlineUrgency(daysFromNow(0), "SUBMITTED", NOW)).toBe(
      "due-soon",
    );
    expect(getDeadlineUrgency(daysFromNow(7), "SUBMITTED", NOW)).toBe(
      "due-soon",
    );
    expect(getDeadlineUrgency(daysFromNow(8), "SUBMITTED", NOW)).toBe(
      "upcoming",
    );
    expect(getDeadlineUrgency(daysFromNow(30), "SUBMITTED", NOW)).toBe(
      "upcoming",
    );
    expect(getDeadlineUrgency(daysFromNow(31), "SUBMITTED", NOW)).toBe("later");
    expect(getDeadlineUrgency(null, "SUBMITTED", NOW)).toBe("no-deadline");
  });

  it("treats accepted and rejected applications as closed outcomes", () => {
    expect(getDeadlineUrgency(daysFromNow(-5), "ACCEPTED", NOW)).toBe("closed");
    expect(getDeadlineUrgency(daysFromNow(2), "REJECTED", NOW)).toBe("closed");
  });
});

describe("deadlineDistanceLabel", () => {
  it("describes overdue, today, future, and missing deadlines", () => {
    expect(deadlineDistanceLabel(daysFromNow(-2), NOW)).toBe("2 days overdue");
    expect(deadlineDistanceLabel(daysFromNow(0), NOW)).toBe("Due today");
    expect(deadlineDistanceLabel(daysFromNow(1), NOW)).toBe("Due in 1 day");
    expect(deadlineDistanceLabel(daysFromNow(10), NOW)).toBe("Due in 10 days");
    expect(deadlineDistanceLabel(null, NOW)).toBe("No deadline saved");
  });
});

describe("getDocumentReadiness", () => {
  it("counts linked and completed private documents", () => {
    expect(
      getDocumentReadiness(
        row({
          id: "a",
          documents: [
            { document: { isComplete: true } },
            { document: { isComplete: false } },
          ],
        }),
      ),
    ).toEqual({ linked: 2, complete: 1, remaining: 1, allComplete: false });
    expect(getDocumentReadiness(row({ id: "b" }))).toEqual({
      linked: 0,
      complete: 0,
      remaining: 0,
      allComplete: false,
    });
  });
});

describe("filterApplications and metrics", () => {
  const applications = [
    row({
      id: "overdue",
      status: "SUBMITTED",
      deadline: daysFromNow(-3),
      notes: "Need transcript",
      university: {
        name: "Alpha University",
        city: "Paris",
        countryCode: "FR",
      },
      documents: [{ document: { isComplete: false } }],
    }),
    row({
      id: "soon",
      status: "PREPARING_DOCUMENTS",
      deadline: daysFromNow(5),
      university: { name: "Beta College", city: "Tokyo", countryCode: "JP" },
      documents: [{ document: { isComplete: true } }],
    }),
    row({
      id: "closed",
      status: "ACCEPTED",
      deadline: daysFromNow(2),
      university: { name: "Gamma Institute", city: "Seoul", countryCode: "KR" },
    }),
    row({
      id: "none",
      status: "RESEARCHING",
      deadline: null,
      university: { name: "Delta School", city: "Berlin", countryCode: "DE" },
    }),
  ];

  it("filters by search, status, and deadline buckets", () => {
    expect(
      filterApplications(
        applications,
        {
          query: "tokyo",
          status: "ALL",
          urgency: "all",
          sort: "deadline",
        },
        NOW,
      ).map((item) => item.id),
    ).toEqual(["soon"]);
    expect(
      filterApplications(
        applications,
        {
          query: "transcript",
          status: "ALL",
          urgency: "all",
          sort: "deadline",
        },
        NOW,
      ).map((item) => item.id),
    ).toEqual(["overdue"]);
    expect(
      filterApplications(
        applications,
        {
          query: "",
          status: "RESEARCHING",
          urgency: "all",
          sort: "deadline",
        },
        NOW,
      ).map((item) => item.id),
    ).toEqual(["none"]);
    expect(
      filterApplications(
        applications,
        {
          query: "",
          status: "ALL",
          urgency: "overdue",
          sort: "deadline",
        },
        NOW,
      ).map((item) => item.id),
    ).toEqual(["overdue"]);
    expect(
      filterApplications(
        applications,
        {
          query: "",
          status: "ALL",
          urgency: "closed",
          sort: "deadline",
        },
        NOW,
      ).map((item) => item.id),
    ).toEqual(["closed"]);
  });

  it("summarizes tracker counts from private application data", () => {
    expect(getApplicationMetrics(applications, NOW)).toEqual({
      total: 4,
      active: 3,
      overdue: 1,
      dueSoon: 1,
      upcoming: 0,
      later: 0,
      noDeadline: 1,
      closed: 1,
      linkedDocuments: 2,
      completeLinkedDocuments: 1,
      applicationsWithIncompleteDocuments: 1,
    });
  });
});

describe("sortApplications and attention", () => {
  it("sorts by deadline with undated applications last", () => {
    const items = [
      row({ id: "none", deadline: null }),
      row({ id: "later", deadline: daysFromNow(12) }),
      row({ id: "soon", deadline: daysFromNow(2) }),
    ];
    expect(sortApplications(items, "deadline").map((item) => item.id)).toEqual([
      "soon",
      "later",
      "none",
    ]);
  });

  it("sorts by recent update, progress, and name", () => {
    const items = [
      row({
        id: "a",
        updatedAt: new Date("2026-11-01T00:00:00.000Z"),
        progress: 20,
        university: { name: "Zulu", city: "X", countryCode: "US" },
      }),
      row({
        id: "b",
        updatedAt: new Date("2026-11-18T00:00:00.000Z"),
        progress: 90,
        university: { name: "Alpha", city: "X", countryCode: "US" },
      }),
    ];
    expect(sortApplications(items, "updated").map((item) => item.id)).toEqual([
      "b",
      "a",
    ]);
    expect(sortApplications(items, "progress").map((item) => item.id)).toEqual([
      "b",
      "a",
    ]);
    expect(sortApplications(items, "name").map((item) => item.id)).toEqual([
      "b",
      "a",
    ]);
  });

  it("returns attention items for overdue and due-soon active applications", () => {
    const items = [
      row({ id: "later", status: "SUBMITTED", deadline: daysFromNow(20) }),
      row({ id: "soon", status: "SUBMITTED", deadline: daysFromNow(3) }),
      row({ id: "overdue", status: "SUBMITTED", deadline: daysFromNow(-1) }),
      row({ id: "closed", status: "REJECTED", deadline: daysFromNow(1) }),
    ];
    expect(getAttentionApplications(items, NOW).map((item) => item.id)).toEqual(
      ["overdue", "soon"],
    );
  });
});

describe("buildApplicationBoard", () => {
  it("keeps all status columns visible when showing all statuses", () => {
    const board = buildApplicationBoard(
      [row({ id: "one", status: "INTERESTED" })],
      { query: "", status: "ALL", urgency: "all", sort: "deadline" },
      NOW,
    );
    expect(board.visible).toHaveLength(1);
    expect(board.groups).toHaveLength(9);
    expect(board.metrics.total).toBe(1);
  });
});
