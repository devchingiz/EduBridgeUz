import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Guardian decision recorded",
  robots: { index: false, follow: false },
};

export default async function GuardianConsentCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ decision?: string }>;
}) {
  const { decision } = await searchParams;
  const approved = decision === "approved";

  return (
    <AuthShell
      title={approved ? "Consent recorded" : "Request declined"}
      description={
        approved
          ? "Thank you. The student's workspace will unlock the next time they sign in."
          : "No consent was recorded. The student's workspace will stay locked and they can send a new request if needed."
      }
      footer={
        <p className="text-muted-foreground text-[13px] leading-6">
          You can close this page. If you change your mind, ask the student to
          send a new consent request.
        </p>
      }
    >
      <div className="space-y-4">
        <Alert variant={approved ? "success" : "info"}>
          {approved
            ? "Guardian consent is now stored with the account's consent history."
            : "The consent link has been used and cannot be reused."}
        </Alert>
        <Button asChild variant="outline" className="w-full">
          <Link href="/">Go to EduBridge</Link>
        </Button>
      </div>
    </AuthShell>
  );
}
