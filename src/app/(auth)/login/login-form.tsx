"use client";

import Link from "next/link";
import { useActionState } from "react";

import { loginAction } from "@/app/(auth)/actions";
import { FormField } from "@/components/auth/form-field";
import { FormMessage } from "@/components/auth/form-message";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { PasswordInput } from "@/components/auth/password-input";
import { SubmitButton } from "@/components/auth/submit-button";
import { Input } from "@/components/ui/input";
import { initialFormState } from "@/lib/actions/state";

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initialFormState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />

      <FormField id="email" label="Email address" error={errors.email}>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "email-error" : undefined}
        />
      </FormField>

      <div className="space-y-1.5">
        <FormField id="password" label="Password" error={errors.password}>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            required
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "password-error" : undefined}
          />
        </FormField>
        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-muted-foreground hover:text-foreground text-[12.5px] font-medium transition-colors"
          >
            Forgot your password?
          </Link>
        </div>
      </div>

      <SubmitButton className="w-full" pendingLabel="Signing in…">
        Sign in
      </SubmitButton>

      <p className="text-muted-foreground text-center text-[13px]">
        New to EduBridge?{" "}
        <Link
          href="/register"
          className="text-foreground font-medium underline underline-offset-2"
        >
          Create an account
        </Link>
      </p>

      <div className="text-muted-foreground flex items-center gap-3 text-[11px]">
        <span className="bg-border h-px flex-1" />
        <span>or</span>
        <span className="bg-border h-px flex-1" />
      </div>
      <GoogleAuthButton intent="sign-in" />
    </form>
  );
}
