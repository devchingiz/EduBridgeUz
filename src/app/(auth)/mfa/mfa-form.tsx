"use client";

import { ArrowRight } from "lucide-react";
import { useActionState } from "react";

import { verifyMfaAction } from "@/app/(auth)/actions";
import { FormField } from "@/components/auth/form-field";
import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { Input } from "@/components/ui/input";
import { initialFormState } from "@/lib/actions/state";

export function MfaForm() {
  const [state, formAction] = useActionState(verifyMfaAction, initialFormState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <FormField
        id="code"
        label="Authentication code"
        error={errors.code}
        hint="6-digit code or XXXX-XXXX-XXXX-XXXX recovery code"
      >
        <Input
          id="code"
          name="code"
          inputMode="text"
          autoComplete="one-time-code"
          autoFocus
          placeholder="000000"
          maxLength={64}
          required
          aria-invalid={Boolean(errors.code)}
          aria-describedby={errors.code ? "code-error" : undefined}
        />
      </FormField>
      <SubmitButton size="lg" className="w-full" pendingLabel="Verifying…">
        Verify and continue
        <ArrowRight aria-hidden="true" />
      </SubmitButton>
    </form>
  );
}
