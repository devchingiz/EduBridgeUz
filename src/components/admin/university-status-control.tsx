"use client";

import { useActionState } from "react";

import { setUniversityStatusAction } from "@/app/dashboard/admin/actions";
import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { Select } from "@/components/ui/select";
import { initialFormState } from "@/lib/actions/state";
import {
  VERIFICATION_LABELS,
  type VerificationStatusValue,
} from "@/lib/catalog/constants";

/** ADMIN-only verification status override; every change is audited. */
export function UniversityStatusControl({
  universityId,
  status,
  options,
}: {
  universityId: string;
  status: VerificationStatusValue;
  options: readonly VerificationStatusValue[];
}) {
  const [state, formAction] = useActionState(
    setUniversityStatusAction,
    initialFormState,
  );

  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <input type="hidden" name="universityId" value={universityId} />
      <div className="flex flex-wrap items-center gap-1.5">
        <Select
          name="status"
          defaultValue={status}
          aria-label="Verification status"
          className="h-8 text-xs"
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {VERIFICATION_LABELS[option]}
            </option>
          ))}
        </Select>
        <SubmitButton size="sm" variant="outline" pendingLabel="Saving…">
          Update
        </SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
