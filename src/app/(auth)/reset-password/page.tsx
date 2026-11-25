import type { Metadata } from "next";
import Link from "next/link";

import { findToken } from "@/lib/auth/tokens";
import { AuthSecurityNote } from "@/components/auth/auth-security-note";
import { AuthShell } from "@/components/auth/auth-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const record = token ? await findToken(token, "PASSWORD_RESET") : null;

  if (!record || !token) {
    return (
      <AuthShell
        title="This reset link is not valid"
        description="The link has expired or has already been used. Request a new one to continue."
        footer={
          <AuthSecurityNote>
            Reset links expire after 30 minutes and can be used once. No
            password has been changed from this link.
          </AuthSecurityNote>
        }
      >
        <div className="space-y-5">
          <Alert variant="warning">
            No password has been changed from this link.
          </Alert>
          <Button asChild size="lg" className="w-full">
            <Link href="/forgot-password">Request a new reset link</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      description={`Resetting the password for ${record.user.email}.`}
      footer={
        <AuthSecurityNote>
          Saving a new password signs out every existing session, including on
          other devices. Reset links cannot be reused.
        </AuthSecurityNote>
      }
    >
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
