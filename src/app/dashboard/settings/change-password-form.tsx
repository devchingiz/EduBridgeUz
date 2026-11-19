"use client";

import { useActionState } from "react";

import { changePasswordAction } from "@/app/dashboard/actions";
import { FormField } from "@/components/auth/form-field";
import { FormMessage } from "@/components/auth/form-message";
import { PasswordInput } from "@/components/auth/password-input";
import { SubmitButton } from "@/components/auth/submit-button";
import { initialFormState } from "@/lib/actions/state";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/constants";

export function ChangePasswordForm() {
  const [state, formAction] = useActionState(
    changePasswordAction,
    initialFormState,
  );
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />

      <FormField
        id="currentPassword"
        label="Current password"
        error={errors.currentPassword}
      >
        <PasswordInput
          id="currentPassword"
          name="currentPassword"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(errors.currentPassword)}
          aria-describedby={
            errors.currentPassword ? "currentPassword-error" : undefined
          }
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="password"
          label="New password"
          error={errors.password}
          hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
        >
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            required
            aria-invalid={Boolean(errors.password)}
            aria-describedby={
              errors.password ? "password-error" : "password-hint"
            }
          />
        </FormField>

        <FormField
          id="confirmPassword"
          label="Confirm new password"
          error={errors.confirmPassword}
        >
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
            required
            aria-invalid={Boolean(errors.confirmPassword)}
            aria-describedby={
              errors.confirmPassword ? "confirmPassword-error" : undefined
            }
          />
        </FormField>
      </div>

      <p className="text-muted-foreground text-[12px] leading-5">
        Changing your password signs out every other device.
      </p>

      <SubmitButton pendingLabel="Saving password…">
        Change password
      </SubmitButton>
    </form>
  );
}
