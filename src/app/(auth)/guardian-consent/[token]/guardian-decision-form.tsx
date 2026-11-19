"use client";

import { useActionState } from "react";

import { guardianDecisionAction } from "@/app/(auth)/actions";
import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { initialFormState } from "@/lib/actions/state";

export function GuardianDecisionForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(
    guardianDecisionAction,
    initialFormState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />

      <SubmitButton
        name="decision"
        value="approve"
        className="w-full"
        pendingLabel="Recording consent…"
      >
        Approve and unlock the workspace
      </SubmitButton>

      <SubmitButton
        name="decision"
        value="decline"
        variant="outline"
        className="w-full"
        pendingLabel="Recording decision…"
      >
        Decline
      </SubmitButton>
    </form>
  );
}
