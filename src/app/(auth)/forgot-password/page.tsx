import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/dal";
import { AuthSecurityNote } from "@/components/auth/auth-security-note";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Reset your password",
  robots: { index: false, follow: false },
};

export default async function ForgotPasswordPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard/settings");

  return (
    <AuthShell
      title="Reset your password"
      description="Enter your email address and we will send a single-use reset link."
      footer={
        <AuthSecurityNote>
          For privacy, we show the same confirmation whether or not an account
          exists. Reset links expire in 30 minutes and can be used once.
        </AuthSecurityNote>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
