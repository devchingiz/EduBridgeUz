import "server-only";

import { Prisma, type VerificationStatus } from "@prisma/client";
import { z } from "zod";

import { getAdvisorContext } from "@/lib/advisor/context";
import {
  CLASSIFICATION_DISCLOSURE,
  classifyUniversity,
} from "@/lib/advisor/classification";
import { PUBLIC_VISIBLE_STATUSES } from "@/lib/catalog/constants";
import { formatMoney } from "@/lib/catalog/format";
import { listCatalogFavorites } from "@/lib/catalog/favorites";
import { getUniversityDiscoveryDetail } from "@/lib/catalog/discovery-queries";
import { countryName, COUNTRY_CODES } from "@/lib/data/countries";
import { degreeLabel } from "@/lib/data/fields";
import { db } from "@/lib/db";
import { logError } from "@/lib/observability/logger";
import type { AdvisorSource } from "@/lib/advisor/types";
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  DOCUMENT_CATEGORY_LABELS,
} from "@/lib/workspace/constants";
import {
  listDocuments,
  listWorkspaceNotifications,
} from "@/lib/workspace/service";
import type { AdvisorToolSpec } from "@/lib/advisor/providers/types";

export type AdvisorToolResult = {
  data: unknown;
  sources: AdvisorSource[];
};

type ToolDefinition = {
  name: string;
  description: string;
  schema: z.ZodTypeAny;
  execute: (userId: string, input: unknown) => Promise<AdvisorToolResult>;
};

const VISIBLE: VerificationStatus[] = [...PUBLIC_VISIBLE_STATUSES];
const DISCOVERY_CURRENCIES = [
  "EUR",
  "USD",
  "GBP",
  "SEK",
  "CAD",
  "AUD",
] as const;
const ANNUAL_PERIODS = [
  "per year",
  "per annum",
  "annual",
  "annually",
  "yearly",
];

function startOfUtcDay(now = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function daysUntil(value: Date, today = startOfUtcDay()): number {
  return Math.max(
    0,
    Math.round((value.getTime() - today.getTime()) / 86_400_000),
  );
}

function sourceFrom(source: {
  url: string;
  title: string;
  verifiedAt?: Date | string | null;
}): AdvisorSource {
  return {
    url: source.url,
    title: source.title,
    verifiedAt:
      typeof source.verifiedAt === "string"
        ? source.verifiedAt
        : (source.verifiedAt?.toISOString().slice(0, 10) ?? null),
  };
}

function uniqueSources(sources: AdvisorSource[]): AdvisorSource[] {
  const seen = new Set<string>();
  const result: AdvisorSource[] = [];
  for (const source of sources) {
    const key = source.url.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(source);
  }
  return result;
}

function minorUnits(amount: number, currency: string): number {
  const fractionDigits =
    new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2;
  return Math.round(amount * 10 ** fractionDigits);
}

function isAnnual(period: string): boolean {
  return ANNUAL_PERIODS.includes(period.trim().toLowerCase());
}

function isClosedStatus(status: string): boolean {
  return status === "ACCEPTED" || status === "REJECTED";
}

function safeText(value: string | null | undefined, max = 400): string | null {
  if (!value) return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

async function getStudentOverview(userId: string): Promise<AdvisorToolResult> {
  const context = await getAdvisorContext(userId);
  return { data: context, sources: [] };
}

async function listApplicationsTool(
  userId: string,
  input: unknown,
): Promise<AdvisorToolResult> {
  const parsed = z
    .object({
      status: z.enum(APPLICATION_STATUSES).optional(),
      limit: z.number().int().min(1).max(20).optional(),
    })
    .strict()
    .parse(input);

  const rows = await db.application.findMany({
    where: {
      userId,
      ...(parsed.status ? { status: parsed.status } : {}),
    },
    include: {
      university: {
        select: {
          name: true,
          city: true,
          countryCode: true,
          slug: true,
        },
      },
      documents: {
        include: {
          document: { select: { name: true, isComplete: true } },
        },
      },
    },
    orderBy: [{ deadline: "asc" }, { updatedAt: "desc" }],
    take: parsed.limit ?? 10,
  });

  const today = startOfUtcDay();
  return {
    data: {
      applications: rows.map((row) => ({
        id: row.id,
        university: {
          name: row.university.name,
          city: row.university.city,
          country: countryName(row.university.countryCode),
          slug: row.university.slug,
        },
        status: row.status,
        statusLabel: APPLICATION_STATUS_LABELS[row.status],
        deadline: row.deadline?.toISOString().slice(0, 10) ?? null,
        daysUntilDeadline: row.deadline ? daysUntil(row.deadline, today) : null,
        progress: row.progress,
        notes: safeText(row.notes, 300),
        linkedDocuments: row.documents.length,
        incompleteLinkedDocuments: row.documents.filter(
          (link) => !link.document.isComplete,
        ).length,
        href: `/dashboard/applications/${row.id}`,
      })),
    },
    sources: [],
  };
}

async function getUpcomingDeadlines(
  userId: string,
  input: unknown,
): Promise<AdvisorToolResult> {
  const parsed = z
    .object({ days: z.number().int().min(1).max(365).optional() })
    .strict()
    .parse(input);
  const windowDays = parsed.days ?? 60;
  const today = startOfUtcDay();
  const end = new Date(today.getTime() + windowDays * 86_400_000);

  const rows = await db.application.findMany({
    where: {
      userId,
      deadline: { not: null, gte: today, lte: end },
      status: { notIn: ["ACCEPTED", "REJECTED"] },
    },
    include: {
      university: { select: { name: true, city: true, countryCode: true } },
    },
    orderBy: { deadline: "asc" },
    take: 12,
  });

  return {
    data: {
      windowDays,
      deadlines: rows.map((row) => ({
        applicationId: row.id,
        university: row.university.name,
        city: row.university.city,
        country: countryName(row.university.countryCode),
        deadline: row.deadline?.toISOString().slice(0, 10) ?? null,
        daysUntil: row.deadline ? daysUntil(row.deadline, today) : null,
        status: row.status,
        statusLabel: APPLICATION_STATUS_LABELS[row.status],
        progress: row.progress,
        href: `/dashboard/applications/${row.id}`,
      })),
    },
    sources: [],
  };
}

async function listDocumentsTool(
  userId: string,
  input: unknown,
): Promise<AdvisorToolResult> {
  const parsed = z
    .object({ incompleteOnly: z.boolean().optional() })
    .strict()
    .parse(input);

  const rows = await listDocuments(userId);
  const filtered = parsed.incompleteOnly
    ? rows.filter((row) => !row.isComplete)
    : rows;

  return {
    data: {
      total: rows.length,
      incomplete: rows.filter((row) => !row.isComplete).length,
      documents: filtered.slice(0, 50).map((row) => ({
        name: row.name,
        category: row.category,
        categoryLabel: DOCUMENT_CATEGORY_LABELS[row.category],
        isComplete: row.isComplete,
        linkedApplications: row.applications
          .map((link) => link.application.university.name)
          .slice(0, 5),
        updatedAt: row.updatedAt.toISOString(),
      })),
    },
    sources: [],
  };
}

async function getIncompleteTasks(userId: string): Promise<AdvisorToolResult> {
  const today = startOfUtcDay();
  const [context, documents, favorites, applications] = await Promise.all([
    getAdvisorContext(userId),
    listDocuments(userId),
    listCatalogFavorites(userId),
    db.application.findMany({
      where: { userId },
      include: {
        university: { select: { name: true, slug: true } },
        documents: { select: { documentId: true } },
      },
      orderBy: [{ deadline: "asc" }, { updatedAt: "desc" }],
    }),
  ]);

  type Task = {
    title: string;
    reason: string;
    href: string;
    severity: "high" | "medium" | "low";
  };
  const tasks: Task[] = [];

  if (!context.profileComplete) {
    tasks.push({
      title: "Complete your student profile",
      reason: `Missing ${context.missingProfileFields.join(", ")}. Personalized recommendations need these details.`,
      href: "/dashboard/profile",
      severity: "medium",
    });
  }

  if (applications.length === 0) {
    tasks.push({
      title: "Add your first application",
      reason:
        "Your application tracker is empty, so deadlines and progress cannot be tracked yet.",
      href: "/dashboard/universities",
      severity: "high",
    });
  }

  for (const application of applications) {
    if (isClosedStatus(application.status)) continue;
    if (application.deadline) {
      const days = daysUntil(application.deadline, today);
      if (days <= 30 && application.progress < 100) {
        tasks.push({
          title: `Prepare the ${application.university.name} application`,
          reason: `Deadline ${application.deadline.toISOString().slice(0, 10)} is ${days} day${
            days === 1 ? "" : "s"
          } away and progress is ${application.progress}%.`,
          href: `/dashboard/applications/${application.id}`,
          severity: days <= 7 ? "high" : "medium",
        });
      }
    }
    if (application.documents.length === 0) {
      tasks.push({
        title: `Link documents to ${application.university.name}`,
        reason: "No uploaded documents are linked to this application yet.",
        href: `/dashboard/applications/${application.id}`,
        severity: "medium",
      });
    }
  }

  const incomplete = documents.filter((document) => !document.isComplete);
  if (incomplete.length > 0) {
    tasks.push({
      title: `Finish ${incomplete.length} document${incomplete.length === 1 ? "" : "s"}`,
      reason: `These are still marked incomplete: ${incomplete
        .slice(0, 4)
        .map((document) => document.name)
        .join(", ")}${incomplete.length > 4 ? ", …" : ""}.`,
      href: "/dashboard/documents",
      severity: "medium",
    });
  }

  const trackedSlugs = new Set(
    applications.map((application) => application.university.slug),
  );
  const savedNotTracked = favorites.filter(
    (favorite) =>
      favorite.entityType === "UNIVERSITY" && !trackedSlugs.has(favorite.slug),
  );
  if (savedNotTracked.length > 0) {
    tasks.push({
      title: `Review ${savedNotTracked.length} saved universit${
        savedNotTracked.length === 1 ? "y" : "ies"
      }`,
      reason: `Saved but not in your tracker: ${savedNotTracked
        .slice(0, 3)
        .map((favorite) => favorite.name)
        .join(", ")}${savedNotTracked.length > 3 ? ", …" : ""}.`,
      href: "/dashboard/favorites",
      severity: "low",
    });
  }

  const order = { high: 0, medium: 1, low: 2 } as const;
  tasks.sort((a, b) => order[a.severity] - order[b.severity]);

  return {
    data: {
      tasks: tasks.slice(0, 10),
      counts: {
        applications: applications.length,
        incompleteDocuments: incomplete.length,
        savedNotTracked: savedNotTracked.length,
      },
    },
    sources: [],
  };
}

type SearchUniversitiesInput = {
  query?: string;
  countryCode?: string;
  degree?: string;
  field?: string;
  maxTuition?: number;
  currency?: string;
  scholarship?: boolean;
  limit?: number;
};

async function searchUniversities(
  userId: string,
  input: SearchUniversitiesInput,
): Promise<AdvisorToolResult> {
  void userId;
  const currency = input.currency ?? "EUR";
  const limit = input.limit ?? 5;
  const programFilter: Prisma.ProgramWhereInput = {
    verificationStatus: { in: VISIBLE },
    ...(input.degree ? { degreeLevel: input.degree as never } : {}),
    ...(input.field
      ? { field: { contains: input.field, mode: "insensitive" } }
      : {}),
    ...(input.maxTuition !== undefined
      ? {
          tuitionFacts: {
            some: {
              currency,
              amountMinor: { lte: minorUnits(input.maxTuition, currency) },
              period: { in: ANNUAL_PERIODS, mode: "insensitive" },
              verificationStatus: { in: VISIBLE },
            },
          },
        }
      : {}),
    ...(input.scholarship
      ? {
          scholarships: {
            some: {
              verificationStatus: { in: VISIBLE },
              scholarship: { verificationStatus: { in: VISIBLE } },
            },
          },
        }
      : {}),
  };

  const rows = await db.university.findMany({
    where: {
      verificationStatus: { in: VISIBLE },
      ...(input.countryCode ? { countryCode: input.countryCode } : {}),
      ...(input.query
        ? { name: { contains: input.query, mode: "insensitive" } }
        : {}),
      programs: { some: programFilter },
    },
    include: {
      primarySource: { select: { url: true, title: true, verifiedAt: true } },
      programs: {
        where: programFilter,
        include: {
          primarySource: {
            select: { url: true, title: true, verifiedAt: true },
          },
          tuitionFacts: {
            where: { verificationStatus: { in: VISIBLE } },
            include: {
              source: { select: { url: true, title: true, verifiedAt: true } },
            },
          },
          deadlineFacts: {
            where: { verificationStatus: { in: VISIBLE } },
            include: {
              source: { select: { url: true, title: true, verifiedAt: true } },
            },
          },
          scholarships: {
            where: {
              verificationStatus: { in: VISIBLE },
              scholarship: { verificationStatus: { in: VISIBLE } },
            },
            include: {
              scholarship: {
                include: {
                  primarySource: {
                    select: { url: true, title: true, verifiedAt: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { name: "asc" },
        take: 4,
      },
    },
    orderBy: { name: "asc" },
    take: limit,
  });

  const sources: AdvisorSource[] = [];
  const universities = rows.map((row) => {
    sources.push(sourceFrom(row.primarySource));
    const programs = row.programs.map((program) => {
      sources.push(sourceFrom(program.primarySource));
      const tuition = program.tuitionFacts
        .filter((fact) => isAnnual(fact.period))
        .map((fact) => {
          sources.push(sourceFrom(fact.source));
          return {
            amountMinor: fact.amountMinor,
            currency: fact.currency,
            period: fact.period,
            applicantGroup: fact.applicantGroup,
            display: formatMoney(fact.amountMinor, fact.currency),
            source: sourceFrom(fact.source),
          };
        });
      const deadlines = program.deadlineFacts.map((deadline) => {
        sources.push(sourceFrom(deadline.source));
        return {
          cycle: deadline.cycle,
          deadlineOn: deadline.deadlineOn?.toISOString().slice(0, 10) ?? null,
          deadlineMonthDay: deadline.deadlineMonthDay,
          note: safeText(deadline.note, 200),
          source: sourceFrom(deadline.source),
        };
      });
      const scholarships = program.scholarships.map((link) => {
        sources.push(sourceFrom(link.scholarship.primarySource));
        return {
          slug: link.scholarship.slug,
          name: link.scholarship.name,
          summary: safeText(link.scholarship.summary, 300),
          source: sourceFrom(link.scholarship.primarySource),
        };
      });
      return {
        name: program.name,
        degreeLevel: program.degreeLevel,
        degreeLabel: degreeLabel(program.degreeLevel),
        field: program.field,
        language: program.language,
        tuition,
        deadlines,
        scholarships,
      };
    });

    return {
      slug: row.slug,
      name: row.name,
      city: row.city,
      country: countryName(row.countryCode),
      countryCode: row.countryCode,
      status: row.verificationStatus,
      lastVerifiedAt: row.lastVerifiedAt?.toISOString().slice(0, 10) ?? null,
      source: sourceFrom(row.primarySource),
      programs,
      href: `/dashboard/universities/${row.slug}`,
    };
  });

  return {
    data: {
      filters: {
        query: input.query ?? null,
        countryCode: input.countryCode ?? null,
        degree: input.degree ?? null,
        field: input.field ?? null,
        maxTuition: input.maxTuition ?? null,
        currency,
        scholarshipOnly: input.scholarship ?? false,
      },
      universities,
      resultCount: universities.length,
      note:
        universities.length === 0
          ? "No public-visible catalog records matched these filters. Do not invent alternatives."
          : null,
    },
    sources: uniqueSources(sources),
  };
}

async function searchUniversitiesTool(
  userId: string,
  input: unknown,
): Promise<AdvisorToolResult> {
  const parsed = z
    .object({
      query: z.string().trim().min(1).max(80).optional(),
      countryCode: z.enum(COUNTRY_CODES).optional(),
      degree: z
        .enum(["BACHELOR", "MASTER", "PHD", "DIPLOMA", "CERTIFICATE"])
        .optional(),
      field: z.string().trim().min(1).max(80).optional(),
      maxTuition: z.number().min(0).max(100_000_000).optional(),
      currency: z.enum(DISCOVERY_CURRENCIES).optional(),
      scholarship: z.boolean().optional(),
      limit: z.number().int().min(1).max(10).optional(),
    })
    .strict()
    .parse(input);
  return searchUniversities(userId, parsed);
}

async function getUniversityDetails(
  userId: string,
  input: unknown,
): Promise<AdvisorToolResult> {
  const parsed = z
    .object({
      slug: z
        .string()
        .trim()
        .regex(/^[a-z0-9-]{1,120}$/),
    })
    .strict()
    .parse(input);

  const detail = await getUniversityDiscoveryDetail(parsed.slug, userId);
  if (!detail) {
    return {
      data: {
        error: "not_found",
        message:
          "No public-visible catalog record exists for that slug. Do not invent details.",
      },
      sources: [],
    };
  }

  const sources: AdvisorSource[] = [sourceFrom(detail.primarySource)];
  const programs = detail.programs.slice(0, 6).map((program) => {
    sources.push(sourceFrom(program.source));
    const tuition = program.tuition.map((fact) => {
      sources.push(sourceFrom(fact.source));
      return {
        ...fact,
        display: formatMoney(fact.amountMinor, fact.currency),
        source: sourceFrom(fact.source),
      };
    });
    const costs = program.costs.map((fact) => {
      sources.push(sourceFrom(fact.source));
      return {
        ...fact,
        display: formatMoney(fact.amountMinor, fact.currency),
        source: sourceFrom(fact.source),
      };
    });
    const requirements = program.requirements
      .slice(0, 20)
      .map((requirement) => {
        sources.push(sourceFrom(requirement.source));
        return {
          kind: requirement.kind,
          summary: safeText(requirement.summary, 500),
          source: sourceFrom(requirement.source),
        };
      });
    const intakes = program.intakes.map((intake) => {
      sources.push(sourceFrom(intake.source));
      return { ...intake, source: sourceFrom(intake.source) };
    });
    const deadlines = program.deadlines.map((deadline) => {
      sources.push(sourceFrom(deadline.source));
      return { ...deadline, source: sourceFrom(deadline.source) };
    });
    const scholarships = program.scholarships.map((scholarship) => {
      sources.push(sourceFrom(scholarship.source));
      sources.push(sourceFrom(scholarship.linkSource));
      return {
        ...scholarship,
        summary: safeText(scholarship.summary, 300),
        source: sourceFrom(scholarship.source),
        linkSource: sourceFrom(scholarship.linkSource),
      };
    });
    return {
      ...program,
      source: sourceFrom(program.source),
      tuition,
      costs,
      requirements,
      intakes,
      deadlines,
      scholarships,
    };
  });

  return {
    data: {
      ...detail,
      primarySource: sourceFrom(detail.primarySource),
      programCount: detail.programs.length,
      programsTruncated: detail.programs.length > programs.length,
      programs,
    },
    sources: uniqueSources(sources),
  };
}

async function getSavedItems(userId: string): Promise<AdvisorToolResult> {
  const favorites = await listCatalogFavorites(userId);
  return {
    data: {
      favorites: favorites.map((favorite) => ({
        entityType: favorite.entityType,
        slug: favorite.slug,
        name: favorite.name,
        context: favorite.context,
        status: favorite.status,
        savedAt: favorite.savedAt.toISOString(),
        href:
          favorite.entityType === "UNIVERSITY"
            ? `/dashboard/universities/${favorite.slug}`
            : `/scholarships/${favorite.slug}`,
      })),
    },
    sources: [],
  };
}

async function summarizeRecentActivity(
  userId: string,
  input: unknown,
): Promise<AdvisorToolResult> {
  const parsed = z
    .object({ days: z.number().int().min(1).max(90).optional() })
    .strict()
    .parse(input);
  const days = parsed.days ?? 30;
  const cutoff = new Date(Date.now() - days * 86_400_000);

  const [events, notifications, documents, applications] = await Promise.all([
    db.applicationStatusEvent.findMany({
      where: {
        application: { userId },
        createdAt: { gte: cutoff },
      },
      include: {
        application: {
          select: {
            id: true,
            university: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    listWorkspaceNotifications(userId),
    db.studentDocument.findMany({
      where: { userId, updatedAt: { gte: cutoff } },
      select: {
        name: true,
        category: true,
        isComplete: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
    db.application.findMany({
      where: { userId, createdAt: { gte: cutoff } },
      include: { university: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return {
    data: {
      windowDays: days,
      statusChanges: events.map((event) => ({
        university: event.application.university.name,
        from: event.fromStatus,
        to: event.toStatus,
        at: event.createdAt.toISOString(),
        href: `/dashboard/applications/${event.application.id}`,
      })),
      notifications: notifications
        .filter((notification) => notification.createdAt >= cutoff)
        .slice(0, 15)
        .map((notification) => ({
          title: notification.title,
          body: safeText(notification.body, 300),
          href: notification.href,
          at: notification.createdAt.toISOString(),
        })),
      documents: documents.map((document) => ({
        name: document.name,
        category: document.category,
        categoryLabel: DOCUMENT_CATEGORY_LABELS[document.category],
        isComplete: document.isComplete,
        updatedAt: document.updatedAt.toISOString(),
      })),
      applicationsAdded: applications.map((application) => ({
        university: application.university.name,
        at: application.createdAt.toISOString(),
        href: `/dashboard/applications/${application.id}`,
      })),
    },
    sources: [],
  };
}

async function getRecommendations(userId: string): Promise<AdvisorToolResult> {
  const today = startOfUtcDay();
  const [context, documents, favorites, applications] = await Promise.all([
    getAdvisorContext(userId),
    listDocuments(userId),
    listCatalogFavorites(userId),
    db.application.findMany({
      where: { userId },
      include: {
        university: { select: { name: true, slug: true } },
        documents: { select: { documentId: true } },
      },
      orderBy: [{ deadline: "asc" }, { updatedAt: "desc" }],
    }),
  ]);

  type Recommendation = {
    title: string;
    why: string;
    href: string;
    priority: "high" | "medium" | "low";
  };
  const recommendations: Recommendation[] = [];
  const sources: AdvisorSource[] = [];

  if (!context.profileComplete) {
    recommendations.push({
      title: "Complete your profile",
      why: `Personalized matches need ${context.missingProfileFields.join(", ")}.`,
      href: "/dashboard/profile",
      priority: "medium",
    });
  }

  if (applications.length === 0) {
    recommendations.push({
      title: "Start tracking an application",
      why: "You have no applications in the tracker, so there are no deadlines or progress to monitor.",
      href: "/dashboard/universities",
      priority: "high",
    });
  }

  for (const application of applications) {
    if (isClosedStatus(application.status)) continue;
    if (application.deadline) {
      const days = daysUntil(application.deadline, today);
      if (days <= 30 && application.progress < 100) {
        recommendations.push({
          title: `Work on ${application.university.name}`,
          why: `Deadline ${application.deadline.toISOString().slice(0, 10)} is ${days} day${
            days === 1 ? "" : "s"
          } away; progress is ${application.progress}%.`,
          href: `/dashboard/applications/${application.id}`,
          priority: days <= 7 ? "high" : "medium",
        });
      }
    }
    if (application.documents.length === 0) {
      recommendations.push({
        title: `Link documents to ${application.university.name}`,
        why: "No documents are linked to this application yet.",
        href: `/dashboard/applications/${application.id}`,
        priority: "medium",
      });
    }
  }

  const incomplete = documents.filter((document) => !document.isComplete);
  if (incomplete.length > 0) {
    recommendations.push({
      title: `Finish ${incomplete.length} document${incomplete.length === 1 ? "" : "s"}`,
      why: `${incomplete
        .slice(0, 3)
        .map((document) => document.name)
        .join(
          ", ",
        )}${incomplete.length > 3 ? ", …" : ""} still need completion.`,
      href: "/dashboard/documents",
      priority: "medium",
    });
  }

  const trackedSlugs = new Set(
    applications.map((application) => application.university.slug),
  );
  const savedNotTracked = favorites.filter(
    (favorite) =>
      favorite.entityType === "UNIVERSITY" && !trackedSlugs.has(favorite.slug),
  );
  if (savedNotTracked.length > 0) {
    recommendations.push({
      title: `Decide on ${savedNotTracked.length} saved universit${
        savedNotTracked.length === 1 ? "y" : "ies"
      }`,
      why: `Saved but not tracked: ${savedNotTracked
        .slice(0, 3)
        .map((favorite) => favorite.name)
        .join(", ")}${savedNotTracked.length > 3 ? ", …" : ""}.`,
      href: "/dashboard/favorites",
      priority: "low",
    });
  }

  if (context.profile?.targetDegree || context.profile?.fieldsOfStudy.length) {
    const currency =
      context.profile.budgetCurrency &&
      (DISCOVERY_CURRENCIES as readonly string[]).includes(
        context.profile.budgetCurrency,
      )
        ? (context.profile
            .budgetCurrency as (typeof DISCOVERY_CURRENCIES)[number])
        : "EUR";
    const search = await searchUniversities(userId, {
      degree: context.profile.targetDegree ?? undefined,
      field: context.profile.fieldsOfStudy[0] ?? undefined,
      ...(context.profile.budgetAmount && context.profile.budgetCurrency
        ? {
            maxTuition: context.profile.budgetAmount,
            currency,
          }
        : {}),
      limit: 3,
    });
    const data = search.data as {
      universities?: Array<{ name: string; slug: string; programs: unknown[] }>;
    };
    const matches = data.universities ?? [];
    if (matches.length > 0) {
      recommendations.push({
        title: "Explore programs that match your profile",
        why: `Based on your target degree, field, and budget, the catalog has ${matches.length} matching universit${
          matches.length === 1 ? "y" : "ies"
        }: ${matches.map((match) => match.name).join(", ")}. Confirm requirements and costs on the official pages.`,
        href: "/dashboard/universities",
        priority: "low",
      });
      sources.push(...search.sources);
    }
  }

  const order = { high: 0, medium: 1, low: 2 } as const;
  recommendations.sort((a, b) => order[a.priority] - order[b.priority]);

  return {
    data: {
      recommendations: recommendations.slice(0, 8),
      generatedFrom: {
        applications: applications.length,
        incompleteDocuments: incomplete.length,
        savedNotTracked: savedNotTracked.length,
        profileComplete: context.profileComplete,
      },
    },
    sources: uniqueSources(sources),
  };
}

/**
 * DB-grounded Reach / Target / Likely planning buckets. Every input fact comes
 * from the catalog or the student's saved profile; the result always carries
 * an explicit estimate-not-guarantee disclosure.
 */
async function classifyShortlistTool(
  userId: string,
  input: unknown,
): Promise<AdvisorToolResult> {
  const parsed = z
    .object({
      slugs: z
        .array(
          z
            .string()
            .trim()
            .regex(/^[a-z0-9-]{1,120}$/),
        )
        .min(1)
        .max(10)
        .optional(),
    })
    .strict()
    .parse(input);

  const [context, favorites] = await Promise.all([
    getAdvisorContext(userId),
    parsed.slugs ? Promise.resolve([]) : listCatalogFavorites(userId),
  ]);
  const slugs =
    parsed.slugs ??
    favorites
      .filter((favorite) => favorite.entityType === "UNIVERSITY")
      .slice(0, 10)
      .map((favorite) => favorite.slug);

  if (slugs.length === 0) {
    return {
      data: {
        error: "no_universities",
        message:
          "No universities were supplied and the student has no saved universities. Do not invent a shortlist.",
        disclosure: CLASSIFICATION_DISCLOSURE,
      },
      sources: [],
    };
  }

  const profile = context.profile;
  const targetDegree = profile?.targetDegree ?? null;
  const fields = profile?.fieldsOfStudy ?? [];
  const rows = await db.university.findMany({
    where: { slug: { in: slugs }, verificationStatus: { in: VISIBLE } },
    select: {
      id: true,
      slug: true,
      name: true,
      rankingPosition: true,
      rankingDisplay: true,
      verificationStatus: true,
      primarySource: {
        select: { url: true, title: true, verifiedAt: true },
      },
      programs: {
        where: { verificationStatus: { in: VISIBLE } },
        select: {
          degreeLevel: true,
          field: true,
          primarySource: {
            select: { url: true, title: true, verifiedAt: true },
          },
          tuitionFacts: {
            where: { verificationStatus: { in: VISIBLE } },
            select: {
              amountMinor: true,
              currency: true,
              period: true,
              source: { select: { url: true, title: true, verifiedAt: true } },
            },
          },
        },
      },
    },
  });

  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  const sources: AdvisorSource[] = [];
  const classifications = slugs.flatMap((slug) => {
    const row = bySlug.get(slug);
    if (!row) return [];
    sources.push(sourceFrom(row.primarySource));

    const annual = row.programs.flatMap((program) =>
      program.tuitionFacts.filter((fact) =>
        ANNUAL_PERIODS.includes(fact.period.trim().toLowerCase()),
      ),
    );
    const lowest = annual.sort((a, b) => a.amountMinor - b.amountMinor)[0];
    if (lowest) sources.push(sourceFrom(lowest.source));
    for (const program of row.programs)
      sources.push(sourceFrom(program.primarySource));

    const result = classifyUniversity({
      rankPosition: row.rankingPosition,
      rankDisplay: row.rankingDisplay,
      annualTuitionMinor: lowest?.amountMinor ?? null,
      tuitionCurrency: lowest?.currency ?? null,
      budgetMajor: profile?.budgetAmount ?? null,
      budgetCurrency: profile?.budgetCurrency ?? null,
      offersTargetDegree:
        targetDegree === null ||
        row.programs.some((program) => program.degreeLevel === targetDegree),
      offersField:
        fields.length === 0 ||
        row.programs.some((program) =>
          fields.some((field) =>
            program.field.toLowerCase().includes(field.toLowerCase()),
          ),
        ),
    });

    return [
      {
        slug: row.slug,
        name: row.name,
        ranking: row.rankingDisplay,
        status: row.verificationStatus,
        indicativeAnnualTuition: lowest
          ? formatMoney(lowest.amountMinor, lowest.currency)
          : null,
        ...result,
        source: sourceFrom(row.primarySource),
      },
    ];
  });

  return {
    data: {
      basedOn: {
        targetDegree,
        fieldsOfStudy: fields,
        budget:
          profile?.budgetAmount !== null && profile?.budgetAmount !== undefined
            ? `${profile.budgetAmount} ${profile.budgetCurrency ?? ""}`.trim()
            : null,
      },
      count: classifications.length,
      classifications,
      disclosure: CLASSIFICATION_DISCLOSURE,
    },
    sources: uniqueSources(sources),
  };
}

const TOOLS: ToolDefinition[] = [
  {
    name: "get_student_overview",
    description:
      "Return a minimized summary of the signed-in student's profile, application counts, document counts, and nearest deadlines. Use this first for personalized advice.",
    schema: z.object({}).strict(),
    execute: (userId) => getStudentOverview(userId),
  },
  {
    name: "list_applications",
    description:
      "List the student's tracked applications with university, status, deadline, progress, notes, and linked-document counts. Optionally filter by status.",
    schema: z
      .object({
        status: z.enum(APPLICATION_STATUSES).optional(),
        limit: z.number().int().min(1).max(20).optional(),
      })
      .strict(),
    execute: listApplicationsTool,
  },
  {
    name: "get_upcoming_deadlines",
    description:
      "Return the student's nearest open application deadlines within a day window. Use for questions about urgency or what is due soon.",
    schema: z
      .object({ days: z.number().int().min(1).max(365).optional() })
      .strict(),
    execute: getUpcomingDeadlines,
  },
  {
    name: "list_documents",
    description:
      "List the student's uploaded document names, categories, completion status, and linked applications. Never returns file contents.",
    schema: z.object({ incompleteOnly: z.boolean().optional() }).strict(),
    execute: listDocumentsTool,
  },
  {
    name: "get_incomplete_tasks",
    description:
      "Return concrete incomplete tasks derived from the student's real profile, applications, documents, and favorites, with reasons and links.",
    schema: z.object({}).strict(),
    execute: (userId) => getIncompleteTasks(userId),
  },
  {
    name: "search_universities",
    description:
      "Search the public-visible EduBridge university catalog with source-linked programs, tuition, deadlines, and scholarships. Returns only records with provenance; never invent alternatives.",
    schema: z
      .object({
        query: z.string().trim().min(1).max(80).optional(),
        countryCode: z.enum(COUNTRY_CODES).optional(),
        degree: z
          .enum(["BACHELOR", "MASTER", "PHD", "DIPLOMA", "CERTIFICATE"])
          .optional(),
        field: z.string().trim().min(1).max(80).optional(),
        maxTuition: z.number().min(0).max(100_000_000).optional(),
        currency: z.enum(DISCOVERY_CURRENCIES).optional(),
        scholarship: z.boolean().optional(),
        limit: z.number().int().min(1).max(10).optional(),
      })
      .strict(),
    execute: searchUniversitiesTool,
  },
  {
    name: "get_university_details",
    description:
      "Return source-linked details for one catalog university by slug: programs, requirements, tuition, costs, intakes, deadlines, and scholarships. Use only these facts.",
    schema: z
      .object({
        slug: z
          .string()
          .trim()
          .regex(/^[a-z0-9-]{1,120}$/),
      })
      .strict(),
    execute: getUniversityDetails,
  },
  {
    name: "get_saved_items",
    description:
      "List the student's saved universities and scholarships from the catalog, with verification status and saved dates.",
    schema: z.object({}).strict(),
    execute: (userId) => getSavedItems(userId),
  },
  {
    name: "summarize_recent_activity",
    description:
      "Summarize the student's recent application status changes, notifications, document updates, and newly added applications.",
    schema: z
      .object({ days: z.number().int().min(1).max(90).optional() })
      .strict(),
    execute: summarizeRecentActivity,
  },
  {
    name: "get_recommendations",
    description:
      "Return deterministic next-step recommendations derived from the student's actual profile, applications, documents, favorites, and catalog matches, with reasons.",
    schema: z.object({}).strict(),
    execute: (userId) => getRecommendations(userId),
  },
  {
    name: "classify_shortlist",
    description:
      "Bucket saved or supplied universities into Reach / Target / Likely PLANNING ESTIMATES using only QS 2027 rank bands and catalog tuition, degree and field facts plus the student's saved budget. Not admission predictions. Always repeat the returned disclosure to the student.",
    schema: z
      .object({
        slugs: z
          .array(
            z
              .string()
              .trim()
              .regex(/^[a-z0-9-]{1,120}$/),
          )
          .min(1)
          .max(10)
          .optional(),
      })
      .strict(),
    execute: classifyShortlistTool,
  },
];

const TOOL_MAP = new Map(TOOLS.map((tool) => [tool.name, tool]));

export function getAdvisorToolSpecs(): AdvisorToolSpec[] {
  return TOOLS.map((tool) => {
    let parameters: Record<string, unknown>;
    try {
      parameters = z.toJSONSchema(tool.schema, {
        io: "input",
      }) as Record<string, unknown>;
      delete parameters.$schema;
    } catch {
      parameters = {
        type: "object",
        properties: {},
        additionalProperties: false,
      };
    }
    return {
      name: tool.name,
      description: tool.description,
      parameters,
    };
  });
}

/**
 * Executes a model-requested tool with the authenticated user's ID. The model
 * never supplies a user ID, and every schema is strict so injected fields are
 * rejected before any query runs.
 */
export async function executeAdvisorTool(
  userId: string,
  name: string,
  rawArguments: string,
): Promise<AdvisorToolResult> {
  const tool = TOOL_MAP.get(name);
  if (!tool) {
    return {
      data: { error: "unknown_tool", message: "That tool is not available." },
      sources: [],
    };
  }

  let parsed: unknown;
  try {
    parsed = rawArguments.trim() ? JSON.parse(rawArguments) : {};
  } catch {
    return {
      data: {
        error: "invalid_arguments",
        message: "Tool arguments must be valid JSON.",
      },
      sources: [],
    };
  }

  const result = tool.schema.safeParse(parsed);
  if (!result.success) {
    return {
      data: {
        error: "invalid_arguments",
        message: "Tool arguments did not match the required schema.",
        fields: result.error.issues
          .map((issue) => issue.path.join("."))
          .filter(Boolean)
          .slice(0, 5),
      },
      sources: [],
    };
  }

  try {
    return await tool.execute(userId, result.data);
  } catch (error) {
    logError("advisor.tool_failed", error, { scope: name });
    return {
      data: {
        error: "tool_failed",
        message: "The data could not be retrieved right now.",
      },
      sources: [],
    };
  }
}
