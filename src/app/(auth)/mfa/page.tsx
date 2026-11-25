import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getMfaChallengeCookie } from "@/lib/auth/mfa-challenge-cookie";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthSecurityNote } from "@/components/auth/auth-security-note";
import { MfaForm } from "./mfa-form";

export const metadata: Metadata = {
  title: "Two-factor verification",
  robots: { index: false, follow: false },
};

export default async function MfaPage() {
  // The challenge lives only in an HttpOnly cookie. Without it there is no
  // pending password check to complete, so return to sign-in.
  const challenge = await getMfaChallengeCookie();
  if (!challenge) redirect("/login");

  return (
    <AuthShell
      title="Two-factor verification"
      description="Enter a code from your authenticator app, or one of the recovery codes you saved when you set it up."
      footer={
        <div className="text-muted-foreground space-y-3 text-[13px] leading-6">
          <AuthSecurityNote>
            We will never ask you for a two-factor code by email or phone. The
            challenge expires after five minutes.
          </AuthSecurityNote>
          <p>
            Lost your device and recovery codes?{" "}
            <Link
              href="/security"
              className="text-foreground font-medium underline underline-offset-2"
            >
              Contact us
            </Link>
          </p>
        </div>
      }
    >
      <MfaForm />
    </AuthShell>
  );
}
