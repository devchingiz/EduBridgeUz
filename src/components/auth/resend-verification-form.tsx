"use client";

import { useActionState } from "react";

import { resendVerificationAction } from "@/app/(auth)/actions";
import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { initialFormState } from "@/lib/actions/state";

export function ResendVerificationForm({
  className,
  label = "Resend verification email",
}: {
  className?: string;
  label?: string;
}) {
  const [state, formAction] = useActionState(
    resendVerificationAction,
    initialFormState,
  );

  return (
    <form action={formAction} className={className}>
      <div className="space-y-3">
        <FormMessage state={state} />
        <SubmitButton
          variant="outline"
          className="w-full"
          pendingLabel="Sending…"
        >
          {label}
        </SubmitButton>
      </div>
    </form>
  );
}
