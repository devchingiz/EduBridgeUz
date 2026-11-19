"use client";

import { LogOut } from "lucide-react";
import { useActionState } from "react";

import {
  revokeOtherSessionsAction,
  revokeSessionAction,
} from "@/app/dashboard/actions";
import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/lib/actions/state";
import { describeUserAgent, formatDateTime, relativeTime } from "@/lib/format";

export type SessionSummary = {
  id: string;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  userAgent: string | null;
};

function SessionRow({
  session,
  current,
}: {
  session: SessionSummary;
  current: boolean;
}) {
  const [state, formAction] = useActionState(
    revokeSessionAction,
    initialFormState,
  );

  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[13px] font-medium">
            {describeUserAgent(session.userAgent)}
          </p>
          {current ? <Badge variant="brand">This device</Badge> : null}
        </div>
        <p className="text-muted-foreground mt-1 text-[12px] leading-5">
          Last active {relativeTime(session.lastUsedAt)} · Signed in{" "}
          {formatDateTime(session.createdAt)}
        </p>
        <p className="text-muted-foreground text-[12px] leading-5">
          Expires {formatDateTime(session.expiresAt)}
        </p>
        {state.status === "error" && state.message ? (
          <p
            role="alert"
            className="mt-1 text-[12px] text-red-600 dark:text-red-400"
          >
            {state.message}
          </p>
        ) : null}
      </div>

      {current ? null : (
        <form action={formAction} className="shrink-0">
          <input type="hidden" name="sessionId" value={session.id} />
          <SubmitButton variant="outline" size="sm" pendingLabel="Signing out…">
            <LogOut aria-hidden="true" />
            Sign out
          </SubmitButton>
        </form>
      )}
    </li>
  );
}

export function SessionList({
  sessions,
  currentSessionId,
}: {
  sessions: SessionSummary[];
  currentSessionId: string;
}) {
  const [state, formAction] = useActionState(
    revokeOtherSessionsAction,
    initialFormState,
  );

  return (
    <div className="space-y-4">
      <FormMessage state={state} />

      <ul className="divide-border divide-y">
        {sessions.map((session) => (
          <SessionRow
            key={session.id}
            session={session}
            current={session.id === currentSessionId}
          />
        ))}
      </ul>

      {sessions.length > 1 ? (
        <form action={formAction}>
          <Button type="submit" variant="outline" size="sm">
            Sign out all other sessions
          </Button>
        </form>
      ) : null}
    </div>
  );
}
