import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/dal";
import { findToken } from "@/lib/auth/tokens";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResendVerificationForm } from "@/components/auth/resend-verification-form";
import { Button } from "@/components/ui/button";
import { VerifyTokenForm } from "./verify-forms";

export const metadata: Metadata = {
  title: "Verify your email",
  robots: { index: false, follow: false },
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();

  if (!params.token && user?.emailVerifiedAt) {
    redirect("/dashboard");
  }

  const tokenRecord = params.token
    ? await findToken(params.token, "EMAIL_VERIFICATION")
    : null;

  if (tokenRecord?.user.emailVerifiedAt) {
    redirect("/dashboard");
  }

  if (tokenRecord) {
    return (
      <AuthShell
        title="Confirm your email"
        description={`This confirms ${tokenRecord.user.email} and finishes setting up your account.`}
        footer={
          <p className="text-muted-foreground text-[13px] leading-6">
            The link can be used once and expires in 24 hours.
          </p>
        }
      >
        <VerifyTokenForm token={params.token ?? ""} />
      </AuthShell>
    );
  }

  if (params.token) {
    return (
      <AuthShell
        title="This link is not valid"
        description="The verification link has expired or has already been used. Sign in and request a new one."
        footer={
          <p className="text-muted-foreground text-[13px] leading-6">
            <Link
              href="/login"
              className="text-foreground font-medium underline underline-offset-2"
            >
              Go to sign in
            </Link>
          </p>
        }
      >
        {user ? <ResendVerificationForm /> : null}
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Check your inbox"
      description={
        user
          ? `We sent a verification link to ${user.email}. Open it on this device, then press the button on the page.`
          : "Open the verification link from your email on this device. If you are signed out, sign in first and we will take you back here."
      }
      footer={
        <div className="text-muted-foreground space-y-3 text-[13px] leading-6">
          <p>
            The link expires in 24 hours. Check your spam folder if it has not
            arrived within a few minutes.
          </p>
          <p>
            Already verified?{" "}
            <Link
              href="/login"
              className="text-foreground font-medium underline underline-offset-2"
            >
              Sign in
            </Link>
          </p>
        </div>
      }
    >
      <div className="space-y-4">
        {user ? (
          <ResendVerificationForm />
        ) : (
          <Button asChild className="w-full">
            <Link href="/login">Sign in to resend the link</Link>
          </Button>
        )}
      </div>
    </AuthShell>
  );
}
