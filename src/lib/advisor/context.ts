import "server-only";

import { countryName } from "@/lib/data/countries";
import { degreeLabel } from "@/lib/data/fields";
import { formatBudget } from "@/lib/format";
import { db } from "@/lib/db";
import { APPLICATION_STATUS_LABELS } from "@/lib/workspace/constants";
import {
  getCalendarApplications,
  getWorkspaceAnalytics,
} from "@/lib/workspace/service";

export type AdvisorContext = {
  today: string;
  profile: {
    nationality: string | null;
    residenceCountry: string | null;
    currentDegree: string | null;
    targetDegree: string | null;
    fieldsOfStudy: string[];
    englishTest: string | null;
    englishScore: string | null;
    budgetAmount: number | null;
    budgetCurrency: string | null;
  } | null;
  profileComplete: boolean;
  missingProfileFields: string[];
  analytics: {
    totalApplications: number;
    activeApplications: number;
    documentCount: number;
    completedDocuments: number;
    averageProgress: number;
  };
  upcomingDeadlines: Array<{
    applicationId: string;
    university: string;
    deadline: string;
    daysUntil: number;
    status: string;
    progress: number;
  }>;
};

const PROFILE_REQUIRED_FIELDS = [
  ["nationality", "nationality"],
  ["residenceCountry", "country of residence"],
  ["targetDegree", "target degree"],
  ["fieldsOfStudy", "fields of study"],
] as const;

function startOfUtcDay(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function daysUntil(deadline: Date, today: Date): number {
  return Math.max(
    0,
    Math.round((deadline.getTime() - today.getTime()) / 86_400_000),
  );
}

/**
 * A minimized, per-request snapshot for personalization. Deliberately excludes
 * name, email, date of birth, guardian contact, session data, and document
 * bytes. It is never persisted.
 */
export async function getAdvisorContext(
  userId: string,
  now = new Date(),
): Promise<AdvisorContext> {
  const [profile, analytics, calendar] = await Promise.all([
    db.studentProfile.findUnique({
      where: { userId },
      select: {
        nationality: true,
        residenceCountry: true,
        currentDegree: true,
        targetDegree: true,
        fieldsOfStudy: true,
        englishTest: true,
        englishScore: true,
        budgetAmount: true,
        budgetCurrency: true,
      },
    }),
    getWorkspaceAnalytics(userId),
    getCalendarApplications(userId),
  ]);

  const today = startOfUtcDay(now);
  const missingProfileFields = profile
    ? PROFILE_REQUIRED_FIELDS.filter(([key]) => {
        const value = profile[key];
        return Array.isArray(value) ? value.length === 0 : !value;
      }).map(([, label]) => label)
    : PROFILE_REQUIRED_FIELDS.map(([, label]) => label);

  const upcomingDeadlines = calendar
    .filter(
      (application) =>
        application.deadline &&
        application.deadline >= today &&
        application.status !== "ACCEPTED" &&
        application.status !== "REJECTED",
    )
    .slice(0, 3)
    .map((application) => ({
      applicationId: application.id,
      university: application.university.name,
      deadline: application.deadline?.toISOString().slice(0, 10) ?? "",
      daysUntil: application.deadline
        ? daysUntil(application.deadline, today)
        : 0,
      status: APPLICATION_STATUS_LABELS[application.status],
      progress: application.progress,
    }));

  return {
    today: today.toISOString().slice(0, 10),
    profile: profile
      ? {
          nationality: profile.nationality,
          residenceCountry: profile.residenceCountry,
          currentDegree: profile.currentDegree,
          targetDegree: profile.targetDegree,
          fieldsOfStudy: profile.fieldsOfStudy,
          englishTest: profile.englishTest,
          englishScore: profile.englishScore,
          budgetAmount: profile.budgetAmount,
          budgetCurrency: profile.budgetCurrency,
        }
      : null,
    profileComplete: missingProfileFields.length === 0,
    missingProfileFields,
    analytics: {
      totalApplications: analytics.totalApplications,
      activeApplications: analytics.activeApplications,
      documentCount: analytics.documentCount,
      completedDocuments: analytics.completedDocuments,
      averageProgress: analytics.averageProgress,
    },
    upcomingDeadlines,
  };
}

export function formatAdvisorContext(context: AdvisorContext): string {
  const profile = context.profile;
  const lines: string[] = [
    "## Authenticated student context",
    `Today (UTC): ${context.today}`,
    "",
    "### Profile",
  ];

  if (!profile) {
    lines.push(
      "- No student profile has been saved yet.",
      "- Ask the student to complete their profile before giving budget- or degree-specific advice.",
    );
  } else {
    lines.push(
      `- Nationality: ${profile.nationality ? countryName(profile.nationality) : "not set"}`,
      `- Country of residence: ${
        profile.residenceCountry
          ? countryName(profile.residenceCountry)
          : "not set"
      }`,
      `- Current degree: ${degreeLabel(profile.currentDegree) || "not set"}`,
      `- Target degree: ${degreeLabel(profile.targetDegree) || "not set"}`,
      `- Fields of study: ${
        profile.fieldsOfStudy.length > 0
          ? profile.fieldsOfStudy.join(", ")
          : "not set"
      }`,
      `- English test: ${profile.englishTest ?? "not set"}${
        profile.englishScore ? ` (score ${profile.englishScore})` : ""
      }`,
      `- Budget: ${formatBudget(profile.budgetAmount, profile.budgetCurrency)}`,
    );
  }

  lines.push(
    `- Profile completeness: ${
      context.profileComplete ? "complete" : "incomplete"
    }${
      context.missingProfileFields.length > 0
        ? ` (missing: ${context.missingProfileFields.join(", ")})`
        : ""
    }`,
    "",
    "### Workspace counts",
    `- Applications: ${context.analytics.totalApplications} total, ${context.analytics.activeApplications} active, average progress ${context.analytics.averageProgress}%`,
    `- Documents: ${context.analytics.documentCount} total, ${context.analytics.completedDocuments} complete`,
  );

  lines.push("", "### Nearest deadlines");
  if (context.upcomingDeadlines.length === 0) {
    lines.push("- No upcoming application deadlines are stored.");
  } else {
    for (const deadline of context.upcomingDeadlines) {
      lines.push(
        `- ${deadline.university}: ${deadline.deadline} (${deadline.daysUntil} day${
          deadline.daysUntil === 1 ? "" : "s"
        } away), status ${deadline.status}, progress ${deadline.progress}%`,
      );
    }
  }

  lines.push(
    "",
    "This context is private to the authenticated student. It contains no other user's data. Use tools for anything not shown here.",
  );

  return lines.join("\n");
}
