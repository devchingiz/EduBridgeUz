import type { Metadata } from "next";
import Link from "next/link";

import { findToken } from "@/lib/auth/tokens";
import { AuthShell } from "@/components/auth/auth-shell";
import { Alert } from "@/components/ui/alert";
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
          <p className="text-muted-foreground text-[13px] leading-6">
            Reset links expire after 30 minutes and can be used once.
          </p>
        }
      >
        <div className="space-y-4">
          <Alert variant="warning">
            No password has been changed from this link.
          </Alert>
          <Link
            href="/forgot-password"
            className="text-foreground text-[13px] font-medium underline underline-offset-2"
          >
            Request a new reset link
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      description={`Resetting the password for ${record.user.email}.`}
      footer={
        <p className="text-muted-foreground text-[12px] leading-5">
          Saving a new password signs out every existing session, including on
          other devices.
        </p>
      }
    >
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
