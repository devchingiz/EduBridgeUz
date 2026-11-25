"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { loginAction } from "@/app/(auth)/actions";
import { AuthDivider } from "@/components/auth/auth-divider";
import { FormField } from "@/components/auth/form-field";
import { FormMessage } from "@/components/auth/form-message";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { PasswordInput } from "@/components/auth/password-input";
import { SubmitButton } from "@/components/auth/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialFormState } from "@/lib/actions/state";

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initialFormState);
  const errors = state.fieldErrors ?? {};

  return (
    <div className="space-y-5">
      <div>
        <GoogleAuthButton intent="sign-in" />
        <p className="text-muted-foreground mt-2 text-center text-[12px]">
          Fastest way in — no password to remember.
        </p>
      </div>

      <AuthDivider label="or sign in with email" />

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
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-primary text-[12.5px] font-medium transition-colors hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            required
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "password-error" : undefined}
          />
          {errors.password ? (
            <p
              id="password-error"
              role="alert"
              className="text-[12.5px] leading-5 text-red-600 dark:text-red-400"
            >
              {errors.password}
            </p>
          ) : null}
        </div>

        <SubmitButton size="lg" className="w-full" pendingLabel="Signing in…">
          Sign in
          <ArrowRight aria-hidden="true" />
        </SubmitButton>
      </form>

      <p className="text-muted-foreground text-center text-[13px]">
        New to EduBridge?{" "}
        <Link
          href="/register"
          className="text-foreground font-semibold underline underline-offset-2"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
