import type { Metadata } from "next";
import Link from "next/link";

import { findToken } from "@/lib/auth/tokens";
import { AuthShell } from "@/components/auth/auth-shell";
import { Alert } from "@/components/ui/alert";
import { GuardianDecisionForm } from "./guardian-decision-form";

export const metadata: Metadata = {
  title: "Guardian consent",
  robots: { index: false, follow: false },
};

export default async function GuardianConsentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const record = await findToken(token, "GUARDIAN_CONSENT");

  if (!record) {
    return (
      <AuthShell
        title="This consent link is not valid"
        description="The link has expired or has already been used. Ask the student to send a new request from their EduBridge dashboard."
        footer={
          <p className="text-muted-foreground text-[13px] leading-6">
            Questions? Contact{" "}
            <a
              href="mailto:privacy@edubridge.example"
              className="text-foreground underline underline-offset-2"
            >
              privacy@edubridge.example
            </a>
            .
          </p>
        }
      >
        <Alert variant="warning">
          No consent has been recorded from this link.
        </Alert>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      wide
      title={`Consent request from ${record.user.name}`}
      description={`${record.user.name} is under 18 and has asked to use EduBridge. We need your decision before their workspace is unlocked.`}
      footer={
        <p className="text-muted-foreground text-[12px] leading-5">
          You can withdraw consent at any time by emailing{" "}
          <a
            href="mailto:privacy@edubridge.example"
            className="text-foreground underline underline-offset-2"
          >
            privacy@edubridge.example
          </a>
          . EduBridge never asks students for payment details.
        </p>
      }
    >
      <div className="space-y-6">
        <div className="border-border bg-muted/40 rounded-xl border p-4">
          <h2 className="text-sm font-semibold">What EduBridge stores</h2>
          <ul className="text-muted-foreground mt-3 space-y-2 text-[12.5px] leading-5">
            <li>Name, email address, and date of birth.</li>
            <li>
              Study preferences such as target degree, fields, and an optional
              budget range.
            </li>
            <li>Application plans and documents the student adds later.</li>
          </ul>
          <p className="text-muted-foreground mt-3 text-[12.5px] leading-5">
            The workspace is private to the student. It is not a public profile
            and is never shown to other students.
          </p>
        </div>

        <div>
          <p className="text-muted-foreground text-[12.5px] leading-5">
            Consent request sent to{" "}
            <span className="text-foreground font-medium">{record.email}</span>.
          </p>
        </div>

        <GuardianDecisionForm token={token} />

        <p className="text-muted-foreground text-center text-[12px] leading-5">
          If this request was not expected, decline it or ignore the email.{" "}
          <Link
            href="/privacy"
            className="text-foreground underline underline-offset-2"
          >
            Read the privacy notice
          </Link>
          .
        </p>
      </div>
    </AuthShell>
  );
}
