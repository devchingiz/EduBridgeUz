"use client";

import { useActionState } from "react";

import { deleteAccountAction } from "@/app/dashboard/actions";
import { FormField } from "@/components/auth/form-field";
import { FormMessage } from "@/components/auth/form-message";
import { PasswordInput } from "@/components/auth/password-input";
import { SubmitButton } from "@/components/auth/submit-button";
import { Input } from "@/components/ui/input";
import { initialFormState } from "@/lib/actions/state";

export function DeleteAccountForm() {
  const [state, formAction] = useActionState(
    deleteAccountAction,
    initialFormState,
  );
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />

      <FormField
        id="delete-password"
        label="Confirm your password"
        error={errors.password}
      >
        <PasswordInput
          id="delete-password"
          name="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(errors.password)}
          aria-describedby={
            errors.password ? "delete-password-error" : undefined
          }
        />
      </FormField>

      <FormField
        id="confirmation"
        label="Type DELETE to confirm"
        error={errors.confirmation}
        hint="This cannot be undone."
      >
        <Input
          id="confirmation"
          name="confirmation"
          autoComplete="off"
          placeholder="DELETE"
          required
          aria-invalid={Boolean(errors.confirmation)}
          aria-describedby={
            errors.confirmation ? "confirmation-error" : "confirmation-hint"
          }
        />
      </FormField>

      <SubmitButton variant="destructive" pendingLabel="Deleting account…">
        Delete my account
      </SubmitButton>
    </form>
  );
}
