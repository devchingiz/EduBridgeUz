"use client";

import { useActionState } from "react";

import {
  revokeUserSessionsAction,
  setUserRoleAction,
} from "@/app/admin/actions";
import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { initialFormState } from "@/lib/actions/state";
import { ASSIGNABLE_ROLES } from "@/lib/admin/permissions";
import { ROLE_LABELS } from "@/lib/auth/roles";
import type { Role } from "@prisma/client";

export function AdminUserControls({
  userId,
  role,
  canManageRoles,
  canManageSessions,
  isSelf,
}: {
  userId: string;
  role: Role;
  canManageRoles: boolean;
  canManageSessions: boolean;
  isSelf: boolean;
}) {
  const [roleState, roleAction] = useActionState(
    setUserRoleAction,
    initialFormState,
  );
  const [sessionState, sessionAction] = useActionState(
    revokeUserSessionsAction,
    initialFormState,
  );

  return (
    <div className="flex flex-col items-start gap-2">
      <form action={roleAction} className="flex flex-col items-start gap-1">
        <input type="hidden" name="userId" value={userId} />
        <div className="flex flex-wrap items-center gap-1.5">
          {canManageRoles ? (
            <>
              <Select
                key={role}
                name="role"
                defaultValue={role}
                aria-label="Account role"
                className="h-8 text-xs"
              >
                {ASSIGNABLE_ROLES.map((option) => (
                  <option key={option} value={option}>
                    {ROLE_LABELS[option]}
                  </option>
                ))}
              </Select>
              <SubmitButton size="sm" variant="outline" pendingLabel="Saving…">
                Update
              </SubmitButton>
            </>
          ) : (
            <Badge variant="muted">{ROLE_LABELS[role]}</Badge>
          )}
        </div>
        <FormMessage state={roleState} />
      </form>

      {canManageSessions && !isSelf ? (
        <form
          action={sessionAction}
          className="flex flex-col items-start gap-1"
        >
          <input type="hidden" name="userId" value={userId} />
          <Button type="submit" size="sm" variant="ghost">
            Revoke sessions
          </Button>
          <FormMessage state={sessionState} />
        </form>
      ) : null}
    </div>
  );
}
