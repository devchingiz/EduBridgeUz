import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";

import { db } from "@/lib/db";
import { getSession, type SessionUser } from "@/lib/auth/session";
import { isMinor } from "@/lib/auth/age";

/**
 * Data Access Layer. Every protected read and mutation goes through these
 * helpers; a page-level check alone is never treated as authorization.
 */

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await getSession();
  return session?.user ?? null;
});

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireRole(allowed: readonly Role[]) {
  const session = await requireUser();
  if (!allowed.includes(session.user.role)) redirect("/dashboard");
  return session;
}

export type WorkspaceProfile = {
  nationality: string | null;
  residenceCountry: string | null;
  currentDegree: string | null;
  targetDegree: string | null;
  fieldsOfStudy: string[];
  englishTest: string | null;
  englishScore: string | null;
  budgetAmount: number | null;
  budgetCurrency: string | null;
  guardianName: string | null;
  guardianEmail: string | null;
  guardianConsentAt: Date | null;
  onboardingCompletedAt: Date | null;
};

export type WorkspaceStatus = {
  isMinor: boolean;
  guardianConsentRequired: boolean;
  guardianConsentGranted: boolean;
  canUseWorkspace: boolean;
  profile: WorkspaceProfile | null;
  profileComplete: boolean;
};

const PROFILE_FIELDS = [
  "nationality",
  "residenceCountry",
  "targetDegree",
  "fieldsOfStudy",
] as const;

export const getWorkspaceStatus = cache(
  async (user: SessionUser): Promise<WorkspaceStatus> => {
    const profile = await db.studentProfile.findUnique({
      where: { userId: user.id },
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
        guardianName: true,
        guardianEmail: true,
        guardianConsentAt: true,
        onboardingCompletedAt: true,
      },
    });

    const minor = user.dateOfBirth ? isMinor(user.dateOfBirth) : false;
    const guardianConsentGranted = Boolean(profile?.guardianConsentAt);

    const profileComplete = Boolean(
      profile &&
      PROFILE_FIELDS.every((field) => {
        const value = profile[field];
        return Array.isArray(value) ? value.length > 0 : Boolean(value);
      }),
    );

    return {
      isMinor: minor,
      guardianConsentRequired: minor && !guardianConsentGranted,
      guardianConsentGranted,
      canUseWorkspace: !minor || guardianConsentGranted,
      profile,
      profileComplete,
    };
  },
);

/**
 * Gate for anything that stores or exposes student workspace data.
 * Account settings deliberately stay reachable so a locked-out student can
 * still change their password, review sessions, or request deletion.
 */
export async function requireWorkspace() {
  const session = await requireUser();
  const status = await getWorkspaceStatus(session.user);

  if (status.guardianConsentRequired) {
    redirect("/dashboard/guardian-consent");
  }

  return { ...session, status };
}
