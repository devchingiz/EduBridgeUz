import type { Metadata } from "next";
import Link from "next/link";

import { GateBanner } from "@/components/dashboard/gate-banner";
import { Button } from "@/components/ui/button";
import { getWorkspaceStatus, requireUser } from "@/lib/auth/dal";
import { requireEmailVerification } from "@/lib/auth/verification-policy";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = {
  title: "Profile",
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const session = await requireUser();
  requireEmailVerification(session.user);
  const status = await getWorkspaceStatus(session.user);
  const profile = status.profile;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground text-[12px] font-medium tracking-wide uppercase">
          Your account
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.025em]">
          Study profile
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Keep your preferences current so recommendations stay relevant.
        </p>
      </div>

      <GateBanner status={status} />

      {status.canUseWorkspace ? (
        <ProfileForm
          isMinor={status.isMinor}
          defaults={{
            name: session.user.name,
            nationality: profile?.nationality ?? "",
            residenceCountry: profile?.residenceCountry ?? "",
            currentDegree: profile?.currentDegree ?? "",
            targetDegree: profile?.targetDegree ?? "",
            fieldsOfStudy: profile?.fieldsOfStudy ?? [],
            englishTest: profile?.englishTest ?? "",
            englishScore: profile?.englishScore ?? "",
            budgetAmount: profile?.budgetAmount?.toString() ?? "",
            budgetCurrency: profile?.budgetCurrency ?? "",
            guardianName: profile?.guardianName ?? "",
            guardianEmail: profile?.guardianEmail ?? "",
          }}
        />
      ) : (
        <div className="surface-card p-5 sm:p-6">
          <h2 className="text-sm font-semibold">Your profile is locked</h2>
          <p className="text-muted-foreground mt-2 max-w-prose text-[13px] leading-6">
            A parent or guardian must approve your account before you can add
            study preferences.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/dashboard/guardian-consent">
              Open guardian consent
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
