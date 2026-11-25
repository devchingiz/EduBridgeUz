"use client";

import { useEffect, useActionState } from "react";

import { verifyEmailAction } from "@/app/(auth)/actions";
import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { initialFormState } from "@/lib/actions/state";
import { removeVerificationTokenFromHistory } from "@/lib/auth/verification-url";

export function VerifyTokenForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(
    verifyEmailAction,
    initialFormState,
  );

  useEffect(() => {
    removeVerificationTokenFromHistory(window.location, window.history);
  }, []);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <SubmitButton className="w-full" pendingLabel="Verifying…">
        Verify my email
      </SubmitButton>
      <p className="text-muted-foreground text-center text-[12px] leading-5">
        For your security, the link only works after you press the button.
      </p>
    </form>
  );
}
