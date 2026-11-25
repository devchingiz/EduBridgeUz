"use client";

import { useActionState } from "react";

import { resendVerificationAction } from "@/app/(auth)/actions";
import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { initialFormState } from "@/lib/actions/state";

export function ResendVerificationForm() {
  const [state, formAction] = useActionState(
    resendVerificationAction,
    initialFormState,
  );

  return (
    <form action={formAction} className="space-y-2">
      <SubmitButton size="sm" pendingLabel="Sending…">
        Send verification email
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
