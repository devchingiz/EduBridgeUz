"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { forgotPasswordAction } from "@/app/(auth)/actions";
import { FormField } from "@/components/auth/form-field";
import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { Input } from "@/components/ui/input";
import { initialFormState } from "@/lib/actions/state";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(
    forgotPasswordAction,
    initialFormState,
  );
  const errors = state.fieldErrors ?? {};

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-4" noValidate>
        <FormMessage state={state} />

        <FormField
          id="email"
          label="Email address"
          error={errors.email}
          hint="Use the email address on your EduBridge account."
        >
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : "email-hint"}
          />
        </FormField>

        <SubmitButton size="lg" className="w-full" pendingLabel="Sending…">
          Send reset link
          <ArrowRight aria-hidden="true" />
        </SubmitButton>
      </form>

      <p className="text-muted-foreground text-center text-[13px]">
        Remembered it?{" "}
        <Link
          href="/login"
          className="text-foreground font-semibold underline underline-offset-2"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
