/** Pure helpers for the private application tracker board. */

import type { ApplicationStatus } from "@prisma/client";

import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
} from "@/lib/workspace/constants";

export type ApplicationBoardRow = {
  id: string;
  status: ApplicationStatus;
  progress: number;
  deadline: Date | null;
  updatedAt: Date;
  notes: string;
  university: {
    name: string;
    city: string;
    countryCode: string;
  };
  documents: {
    document: {
      isComplete: boolean;
    };
  }[];
};

export type ApplicationStatusFilter = ApplicationStatus | "ALL";

export type DeadlineUrgency =
  "overdue" | "due-soon" | "upcoming" | "later" | "no-deadline" | "closed";

export type DeadlineFilter =
  | "all"
  | "overdue"
  | "next-7-days"
  | "next-30-days"
  | "later"
  | "no-deadline"
  | "closed";

export type ApplicationSort = "deadline" | "updated" | "progress" | "name";

export type ApplicationFilters = {
  query: string;
  status: ApplicationStatusFilter;
  urgency: DeadlineFilter;
  sort: ApplicationSort;
};

const DEADLINE_FILTERS = [
  "all",
  "overdue",
  "next-7-days",
  "next-30-days",
  "later",
  "no-deadline",
  "closed",
] as const satisfies readonly DeadlineFilter[];

const APPLICATION_SORTS = [
  "deadline",
  "updated",
  "progress",
  "name",
] as const satisfies readonly ApplicationSort[];

const DAY_MS = 86_400_000;
const SOON_DAYS = 7;
const MONTH_DAYS = 30;

export const DEADLINE_FILTER_LABELS: Record<DeadlineFilter, string> = {
  all: "All deadline states",
  overdue: "Overdue",
  "next-7-days": "Due in 7 days",
  "next-30-days": "Due in 30 days",
  later: "Later than 30 days",
  "no-deadline": "No deadline saved",
  closed: "Closed outcomes",
};

export const APPLICATION_SORT_LABELS: Record<ApplicationSort, string> = {
  deadline: "Deadline (soonest)",
  updated: "Recently updated",
  progress: "Progress (highest)",
  name: "University name",
};

export const URGENCY_LABELS: Record<DeadlineUrgency, string> = {
  overdue: "Overdue",
  "due-soon": "Due soon",
  upcoming: "Upcoming",
  later: "Later",
  "no-deadline": "No deadline",
  closed: "Closed",
};

export function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function isDeadlineFilter(value: string): value is DeadlineFilter {
  return (DEADLINE_FILTERS as readonly string[]).includes(value);
}

function isApplicationSort(value: string): value is ApplicationSort {
  return (APPLICATION_SORTS as readonly string[]).includes(value);
}

export function parseApplicationFilters(raw: {
  q?: string | string[];
  status?: string | string[];
  urgency?: string | string[];
  sort?: string | string[];
}): ApplicationFilters {
  const rawStatus = firstParam(raw.status).toUpperCase();
  const status =
    rawStatus === "ALL" || rawStatus === ""
      ? "ALL"
      : (APPLICATION_STATUSES.find((item) => item === rawStatus) ?? "ALL");
  const rawUrgency = firstParam(raw.urgency);
  const rawSort = firstParam(raw.sort);

  return {
    query: firstParam(raw.q).trim().slice(0, 120),
    status,
    urgency: isDeadlineFilter(rawUrgency) ? rawUrgency : "all",
    sort: isApplicationSort(rawSort) ? rawSort : "deadline",
  };
}

export function hasActiveFilters(filters: ApplicationFilters): boolean {
  return (
    filters.query.length > 0 ||
    filters.status !== "ALL" ||
    filters.urgency !== "all"
  );
}

export function isClosedStatus(status: ApplicationStatus): boolean {
  return status === "ACCEPTED" || status === "REJECTED";
}

function utcDayNumber(date: Date): number {
  return (
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) /
    DAY_MS
  );
}

export function daysUntilDeadline(deadline: Date, now: Date): number {
  return utcDayNumber(deadline) - utcDayNumber(now);
}

export function getDeadlineUrgency(
  deadline: Date | null,
  status: ApplicationStatus,
  now: Date,
): DeadlineUrgency {
  if (isClosedStatus(status)) return "closed";
  if (!deadline || Number.isNaN(deadline.getTime())) return "no-deadline";

  const days = daysUntilDeadline(deadline, now);
  if (days < 0) return "overdue";
  if (days <= SOON_DAYS) return "due-soon";
  if (days <= MONTH_DAYS) return "upcoming";
  return "later";
}

export function deadlineDistanceLabel(
  deadline: Date | null,
  now: Date,
): string {
  if (!deadline || Number.isNaN(deadline.getTime())) return "No deadline saved";
  const days = daysUntilDeadline(deadline, now);
  if (days < 0) {
    const amount = Math.abs(days);
    return `${amount} day${amount === 1 ? "" : "s"} overdue`;
  }
  if (days === 0) return "Due today";
  return `Due in ${days} day${days === 1 ? "" : "s"}`;
}

export function getDocumentReadiness(
  application: Pick<ApplicationBoardRow, "documents">,
) {
  const documents = application.documents.map((link) => link.document);
  const complete = documents.filter((document) => document.isComplete).length;
  return {
    linked: documents.length,
    complete,
    remaining: documents.length - complete,
    allComplete: documents.length > 0 && complete === documents.length,
  };
}

export function getApplicationMetrics(
  applications: ApplicationBoardRow[],
  now: Date,
) {
  const metrics = {
    total: applications.length,
    active: 0,
    overdue: 0,
    dueSoon: 0,
    upcoming: 0,
    later: 0,
    noDeadline: 0,
    closed: 0,
    linkedDocuments: 0,
    completeLinkedDocuments: 0,
    applicationsWithIncompleteDocuments: 0,
  };

  for (const application of applications) {
    if (!isClosedStatus(application.status)) metrics.active += 1;

    switch (getDeadlineUrgency(application.deadline, application.status, now)) {
      case "overdue":
        metrics.overdue += 1;
        break;
      case "due-soon":
        metrics.dueSoon += 1;
        break;
      case "upcoming":
        metrics.upcoming += 1;
        break;
      case "later":
        metrics.later += 1;
        break;
      case "no-deadline":
        metrics.noDeadline += 1;
        break;
      case "closed":
        metrics.closed += 1;
        break;
    }

    const readiness = getDocumentReadiness(application);
    metrics.linkedDocuments += readiness.linked;
    metrics.completeLinkedDocuments += readiness.complete;
    if (readiness.remaining > 0) {
      metrics.applicationsWithIncompleteDocuments += 1;
    }
  }

  return metrics;
}

function urgencyForFilter(filter: DeadlineFilter): DeadlineUrgency[] | null {
  switch (filter) {
    case "overdue":
      return ["overdue"];
    case "next-7-days":
      return ["due-soon"];
    case "next-30-days":
      return ["due-soon", "upcoming"];
    case "later":
      return ["later"];
    case "no-deadline":
      return ["no-deadline"];
    case "closed":
      return ["closed"];
    default:
      return null;
  }
}

export function filterApplications(
  applications: ApplicationBoardRow[],
  filters: ApplicationFilters,
  now: Date,
): ApplicationBoardRow[] {
  const query = filters.query.toLowerCase();
  const allowedUrgencies = urgencyForFilter(filters.urgency);

  return applications.filter((application) => {
    if (filters.status !== "ALL" && application.status !== filters.status) {
      return false;
    }

    if (
      allowedUrgencies &&
      !allowedUrgencies.includes(
        getDeadlineUrgency(application.deadline, application.status, now),
      )
    ) {
      return false;
    }

    if (!query) return true;
    const haystack = [
      application.university.name,
      application.university.city,
      application.university.countryCode,
      APPLICATION_STATUS_LABELS[application.status],
      application.notes,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}

function compareName(a: ApplicationBoardRow, b: ApplicationBoardRow): number {
  return a.university.name.localeCompare(b.university.name);
}

function deadlineTime(application: ApplicationBoardRow): number {
  return application.deadline?.getTime() ?? Number.POSITIVE_INFINITY;
}

export function sortApplications(
  applications: ApplicationBoardRow[],
  sort: ApplicationSort,
): ApplicationBoardRow[] {
  return [...applications].sort((a, b) => {
    switch (sort) {
      case "updated":
        return (
          b.updatedAt.getTime() - a.updatedAt.getTime() || compareName(a, b)
        );
      case "progress":
        return b.progress - a.progress || deadlineTime(a) - deadlineTime(b);
      case "name":
        return compareName(a, b) || deadlineTime(a) - deadlineTime(b);
      default:
        return deadlineTime(a) - deadlineTime(b) || compareName(a, b);
    }
  });
}

export function getAttentionApplications(
  applications: ApplicationBoardRow[],
  now: Date,
): ApplicationBoardRow[] {
  return applications
    .filter((application) => {
      const urgency = getDeadlineUrgency(
        application.deadline,
        application.status,
        now,
      );
      return urgency === "overdue" || urgency === "due-soon";
    })
    .sort((a, b) => deadlineTime(a) - deadlineTime(b) || compareName(a, b));
}

export function buildApplicationBoard(
  applications: ApplicationBoardRow[],
  filters: ApplicationFilters,
  now: Date,
) {
  const visible = sortApplications(
    filterApplications(applications, filters, now),
    filters.sort,
  );
  const statuses = APPLICATION_STATUSES.filter(
    (status) => filters.status === "ALL" || status === filters.status,
  );

  return {
    metrics: getApplicationMetrics(applications, now),
    visible,
    groups: statuses.map((status) => ({
      status,
      items: visible.filter((application) => application.status === status),
    })),
    attention: getAttentionApplications(applications, now),
  };
}
