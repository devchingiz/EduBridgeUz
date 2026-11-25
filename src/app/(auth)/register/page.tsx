import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/dal";
import { requireEmailVerification } from "@/lib/auth/verification-policy";
import { AuthSecurityNote } from "@/components/auth/auth-security-note";
import { AuthShell } from "@/components/auth/auth-shell";
import { GoogleAuthMessage } from "@/components/auth/google-auth-message";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Create your account",
  description:
    "Create a free EduBridge account to plan international university applications and scholarship searches.",
  robots: { index: true, follow: true },
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();

  if (user) {
    requireEmailVerification(user);
    redirect("/dashboard");
  }

  return (
    <AuthShell
      wide
      title="Create your account"
      description="Just a few details. You can add study preferences later."
      footer={
        <AuthSecurityNote>
          Your password is stored as an Argon2id hash, never in plain text. We
          use your date of birth only to check age eligibility.
        </AuthSecurityNote>
      }
    >
      <div className="space-y-4">
        <GoogleAuthMessage code={params.google} />
        <RegisterForm />
      </div>
    </AuthShell>
  );
}
