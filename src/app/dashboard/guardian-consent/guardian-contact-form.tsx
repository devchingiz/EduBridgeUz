"use client";

import { useActionState } from "react";

import { resendGuardianConsentAction } from "@/app/dashboard/actions";
import { FormField } from "@/components/auth/form-field";
import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { Input } from "@/components/ui/input";
import { initialFormState } from "@/lib/actions/state";

export function GuardianContactForm({
  guardianName,
  guardianEmail,
}: {
  guardianName: string;
  guardianEmail: string;
}) {
  const [state, formAction] = useActionState(
    resendGuardianConsentAction,
    initialFormState,
  );
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="guardianName"
          label="Parent or guardian's name"
          error={errors.guardianName}
        >
          <Input
            id="guardianName"
            name="guardianName"
            defaultValue={guardianName}
            autoComplete="off"
            required
            aria-invalid={Boolean(errors.guardianName)}
            aria-describedby={
              errors.guardianName ? "guardianName-error" : undefined
            }
          />
        </FormField>

        <FormField
          id="guardianEmail"
          label="Parent or guardian's email"
          error={errors.guardianEmail}
          hint="They receive one consent request. We never email them marketing."
        >
          <Input
            id="guardianEmail"
            name="guardianEmail"
            type="email"
            inputMode="email"
            defaultValue={guardianEmail}
            autoComplete="off"
            required
            aria-invalid={Boolean(errors.guardianEmail)}
            aria-describedby={
              errors.guardianEmail
                ? "guardianEmail-error"
                : "guardianEmail-hint"
            }
          />
        </FormField>
      </div>

      <p className="text-muted-foreground text-[12px] leading-5">
        Sending a new request invalidates any earlier consent link.
      </p>

      <SubmitButton pendingLabel="Sending request…">
        Send consent request
      </SubmitButton>
    </form>
  );
}
