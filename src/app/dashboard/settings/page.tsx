import type { Metadata } from "next";
import {
  KeyRound,
  MonitorSmartphone,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth/dal";
import { getMfaStatus } from "@/lib/auth/mfa";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { listSessions } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { ChangePasswordForm } from "./change-password-form";
import { DeleteAccountForm } from "./delete-account-form";
import { MfaSettings } from "./mfa-settings";
import { SessionList } from "./session-list";

export const metadata: Metadata = {
  title: "Account settings",
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const session = await requireUser();
  const [sessions, mfa] = await Promise.all([
    listSessions(session.user.id),
    getMfaStatus(session.user.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground text-[12px] font-medium tracking-wide uppercase">
          Your account
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.025em]">
          Account settings
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage your sign-in details, active sessions, and account status.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account details</CardTitle>
          <CardDescription>
            Your sign-in email and the role attached to this account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-4 text-[13px] sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground text-[11px] font-medium uppercase">
                Email address
              </dt>
              <dd className="mt-1 break-all">{session.user.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-[11px] font-medium uppercase">
                Role
              </dt>
              <dd className="mt-1">{ROLE_LABELS[session.user.role]}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-[11px] font-medium uppercase">
                Member since
              </dt>
              <dd className="mt-1">{formatDate(session.user.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-[11px] font-medium uppercase">
                Date of birth
              </dt>
              <dd className="mt-1">
                {formatDate(session.user.dateOfBirth)}
                {session.user.dateOfBirth ? " · Used only for age rules" : ""}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound aria-hidden="true" className="size-4" />
            Password
          </CardTitle>
          <CardDescription>
            Use a unique password of at least 12 characters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck aria-hidden="true" className="size-4" />
            Two-factor authentication
          </CardTitle>
          <CardDescription>
            Require a code from an authenticator app in addition to your
            password when signing in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MfaSettings
            enabled={mfa.enabled}
            enabledAt={mfa.enabledAt ? formatDate(mfa.enabledAt) : null}
            recoveryCodesRemaining={mfa.recoveryCodesRemaining}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MonitorSmartphone aria-hidden="true" className="size-4" />
            Active sessions
          </CardTitle>
          <CardDescription>
            Sessions expire after seven days of inactivity, and always after 30
            days. Sign out anything you do not recognise.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SessionList
            sessions={sessions}
            currentSessionId={session.session.id}
          />
        </CardContent>
      </Card>

      <Card className="border-red-200 dark:border-red-900/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
            <ShieldAlert aria-hidden="true" className="size-4" />
            Delete account
          </CardTitle>
          <CardDescription>
            Permanently remove your profile, sessions, and verification tokens.
            An anonymised audit record is kept for security and abuse
            prevention.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccountForm />
        </CardContent>
      </Card>
    </div>
  );
}
