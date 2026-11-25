"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useActionState } from "react";

import { resetPasswordAction } from "@/app/(auth)/actions";
import { FormField } from "@/components/auth/form-field";
import { FormMessage } from "@/components/auth/form-message";
import { PasswordInput } from "@/components/auth/password-input";
import { SubmitButton } from "@/components/auth/submit-button";
import { initialFormState } from "@/lib/actions/state";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/constants";
import { removeVerificationTokenFromHistory } from "@/lib/auth/verification-url";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(
    resetPasswordAction,
    initialFormState,
  );

  useEffect(() => {
    removeVerificationTokenFromHistory(window.location, window.history);
  }, []);

  const errors = state.fieldErrors ?? {};

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-4" noValidate>
        <input type="hidden" name="token" value={token} />
        <FormMessage state={state} />

        <FormField
          id="password"
          label="New password"
          error={errors.password}
          hint={`At least ${PASSWORD_MIN_LENGTH} characters. Use a password you have not used here before.`}
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

        <SubmitButton
          size="lg"
          className="w-full"
          pendingLabel="Saving password…"
        >
          Save new password
          <ArrowRight aria-hidden="true" />
        </SubmitButton>
      </form>

      <p className="text-muted-foreground text-center text-[13px]">
        Need another link?{" "}
        <Link
          href="/forgot-password"
          className="text-foreground font-semibold underline underline-offset-2"
        >
          Request a new reset link
        </Link>
      </p>
    </div>
  );
}
