"use client";

import { useActionState } from "react";
import type { Role } from "@prisma/client";

import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { Select } from "@/components/ui/select";
import { initialFormState, type FormState } from "@/lib/actions/state";
import { ROLE_LABELS } from "@/lib/auth/roles";

type Action = (previous: FormState, formData: FormData) => Promise<FormState>;

const ROLE_OPTIONS: Role[] = ["STUDENT", "REVIEWER", "ADMIN"];

export function UserRoleControls({
  userId,
  role,
  isSelf,
  activeSessions,
  setRoleAction,
  revokeSessionsAction,
}: {
  userId: string;
  role: Role;
  isSelf: boolean;
  activeSessions: number;
  setRoleAction: Action;
  revokeSessionsAction: Action;
}) {
  const [roleState, roleAction, rolePending] = useActionState(
    setRoleAction,
    initialFormState,
  );
  const [sessionState, sessionAction, sessionPending] = useActionState(
    revokeSessionsAction,
    initialFormState,
  );

  if (isSelf) {
    return (
      <span className="text-muted-foreground text-[12px]">
        Your account — use Account settings
      </span>
    );
  }

  return (
    <div className="flex min-w-[13rem] flex-col gap-2">
      <form action={roleAction} className="flex items-center gap-2">
        <input type="hidden" name="userId" value={userId} />
        <Select
          name="role"
          defaultValue={role}
          aria-label="Account role"
          className="h-8 flex-1 text-[12px]"
        >
          {ROLE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {ROLE_LABELS[option]}
            </option>
          ))}
        </Select>
        <SubmitButton
          variant="outline"
          size="sm"
          className="h-8"
          disabled={rolePending}
          pendingLabel="Saving"
        >
          Save
        </SubmitButton>
      </form>
      {activeSessions > 0 ? (
        <form action={sessionAction}>
          <input type="hidden" name="userId" value={userId} />
          <SubmitButton
            variant="ghost"
            size="sm"
            className="h-8 px-0 text-[12px]"
            disabled={sessionPending}
            pendingLabel="Signing out"
          >
            Sign out {activeSessions} active session
            {activeSessions === 1 ? "" : "s"}
          </SubmitButton>
        </form>
      ) : null}
      <FormMessage state={roleState} />
      <FormMessage state={sessionState} />
    </div>
  );
}
