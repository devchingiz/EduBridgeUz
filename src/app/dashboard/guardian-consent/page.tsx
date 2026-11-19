import type { Metadata } from "next";
import { CheckCircle2, ShieldCheck, ShieldQuestion } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getWorkspaceStatus, requireUser } from "@/lib/auth/dal";
import { formatDateTime } from "@/lib/format";
import { GuardianContactForm } from "./guardian-contact-form";

export const metadata: Metadata = {
  title: "Guardian consent",
  robots: { index: false, follow: false },
};

export default async function GuardianConsentSettingsPage() {
  const session = await requireUser();
  const status = await getWorkspaceStatus(session.user);
  const profile = status.profile;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground text-[12px] font-medium tracking-wide uppercase">
          Privacy and safety
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.025em]">
          Guardian consent
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Students under 18 need a parent or guardian to approve their
          workspace.
        </p>
      </div>

      {!status.isMinor ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck aria-hidden="true" className="size-4" />
              Not required
            </CardTitle>
            <CardDescription>
              Guardian consent is only required for students under 18. Your
              account does not need it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-[12.5px] leading-5">
              You can still keep a guardian contact in your study profile if you
              want. It is never used for marketing.
            </p>
          </CardContent>
        </Card>
      ) : status.guardianConsentGranted ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2
                aria-hidden="true"
                className="size-4 text-emerald-600 dark:text-emerald-400"
              />
              Consent recorded
              <Badge variant="success">Approved</Badge>
            </CardTitle>
            <CardDescription>
              Your guardian approved your EduBridge workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-[13px]">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground text-[11px] font-medium uppercase">
                  Guardian
                </dt>
                <dd className="mt-1">{profile?.guardianName ?? "Not set"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-[11px] font-medium uppercase">
                  Recorded
                </dt>
                <dd className="mt-1">
                  {formatDateTime(profile?.guardianConsentAt)}
                </dd>
              </div>
            </dl>
            <p className="text-muted-foreground text-[12px] leading-5">
              A guardian can withdraw consent at any time by contacting{" "}
              <a
                href="mailto:privacy@edubridge.example"
                className="text-foreground underline underline-offset-2"
              >
                privacy@edubridge.example
              </a>
              . Withdrawal locks the workspace again.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Alert variant="warning">
            <ShieldQuestion
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            <div>
              <p className="font-medium">Consent is still pending</p>
              <p className="mt-0.5 text-[12.5px] opacity-80">
                Your workspace stays locked until your guardian approves. Send
                or resend the request below.
              </p>
            </div>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>Guardian contact</CardTitle>
              <CardDescription>
                We email this person a single-use consent link. Update the
                details if the first request did not arrive.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GuardianContactForm
                guardianName={profile?.guardianName ?? ""}
                guardianEmail={profile?.guardianEmail ?? ""}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
