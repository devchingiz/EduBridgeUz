import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/dal";
import { requireEmailVerification } from "@/lib/auth/verification-policy";
import { AuthSecurityNote } from "@/components/auth/auth-security-note";
import { AuthShell } from "@/components/auth/auth-shell";
import { Alert } from "@/components/ui/alert";
import { GoogleAuthMessage } from "@/components/auth/google-auth-message";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your EduBridge student workspace.",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    verified?: string;
    reset?: string;
    loggedOut?: string;
    google?: string;
  }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();

  if (user) {
    requireEmailVerification(user);
    redirect("/dashboard");
  }

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to continue planning your university applications."
      footer={
        <AuthSecurityNote>
          We will never ask for your password by email. Repeated failed sign-ins
          are temporarily throttled, and a reset link signs out other devices.
        </AuthSecurityNote>
      }
    >
      <div className="space-y-4">
        {params.verified ? (
          <Alert variant="success">Email verified.</Alert>
        ) : null}
        {params.reset ? (
          <Alert variant="success">
            Password updated and other sessions signed out. Sign in with your
            new password.
          </Alert>
        ) : null}
        {params.loggedOut ? (
          <Alert variant="success">You have been signed out.</Alert>
        ) : null}
        <GoogleAuthMessage code={params.google} />
        <LoginForm />
      </div>
    </AuthShell>
  );
}
