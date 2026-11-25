"use client";

import { useActionState } from "react";

import {
  grantPermissionAction,
  revokePermissionAction,
} from "@/app/admin/actions";
import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { Select } from "@/components/ui/select";
import { initialFormState } from "@/lib/actions/state";
import { ADMIN_PERMISSIONS, type Permission } from "@/lib/admin/permissions";

export function PermissionControls({
  userId,
  grants,
  isSelf,
}: {
  userId: string;
  grants: readonly Permission[];
  isSelf: boolean;
}) {
  const [grantState, grantAction] = useActionState(
    grantPermissionAction,
    initialFormState,
  );
  const [revokeState, revokeAction] = useActionState(
    revokePermissionAction,
    initialFormState,
  );

  if (isSelf) {
    return (
      <p className="text-muted-foreground text-[11.5px]">
        Super Admin role permissions cannot be changed here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <form action={grantAction} className="flex flex-col items-start gap-1">
        <input type="hidden" name="userId" value={userId} />
        <div className="flex flex-wrap items-center gap-1.5">
          <Select
            name="permission"
            aria-label="Permission to grant"
            className="h-8 text-xs"
          >
            {ADMIN_PERMISSIONS.map((permission) => (
              <option key={permission} value={permission}>
                {permission}
              </option>
            ))}
          </Select>
          <SubmitButton size="sm" variant="outline" pendingLabel="Granting…">
            Grant
          </SubmitButton>
        </div>
        <FormMessage state={grantState} />
      </form>

      <form action={revokeAction} className="flex flex-col items-start gap-1">
        <input type="hidden" name="userId" value={userId} />
        <div className="flex flex-wrap items-center gap-1.5">
          <Select
            name="permission"
            aria-label="Permission to revoke"
            className="h-8 text-xs"
            defaultValue={grants[0] ?? ADMIN_PERMISSIONS[0]}
          >
            {grants.length === 0 ? (
              <option value={ADMIN_PERMISSIONS[0]}>
                {ADMIN_PERMISSIONS[0]}
              </option>
            ) : (
              grants.map((permission) => (
                <option key={permission} value={permission}>
                  {permission}
                </option>
              ))
            )}
          </Select>
          <SubmitButton size="sm" variant="ghost" pendingLabel="Revoking…">
            Revoke
          </SubmitButton>
        </div>
        <FormMessage state={revokeState} />
      </form>
    </div>
  );
}
