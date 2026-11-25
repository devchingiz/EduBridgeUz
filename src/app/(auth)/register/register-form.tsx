"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { registerAction } from "@/app/(auth)/actions";
import { AuthDivider } from "@/components/auth/auth-divider";
import { FormField } from "@/components/auth/form-field";
import { FormMessage } from "@/components/auth/form-message";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { PasswordInput } from "@/components/auth/password-input";
import { SubmitButton } from "@/components/auth/submit-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialFormState } from "@/lib/actions/state";
import { MINIMUM_AGE, PASSWORD_MIN_LENGTH } from "@/lib/auth/constants";
import { evaluateAgeGate, parseDateOfBirth } from "@/lib/auth/age";

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, initialFormState);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmationError, setConfirmationError] = useState<string | null>(
    null,
  );

  const parsed = dateOfBirth ? parseDateOfBirth(dateOfBirth) : null;
  const needsGuardian = parsed
    ? evaluateAgeGate(parsed).status === "minor"
    : false;
  const errors = state.fieldErrors ?? {};

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (password !== confirmPassword) {
      event.preventDefault();
      setConfirmationError("Passwords do not match.");
      return;
    }
    setConfirmationError(null);
  }

  return (
    <div className="space-y-5">
      <form
        action={formAction}
        className="space-y-4"
        noValidate
        onSubmit={handleSubmit}
      >
        <FormMessage state={state} />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="name" label="Full name" error={errors.name}>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              placeholder="Your name"
              required
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "name-error" : undefined}
            />
          </FormField>

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

          <FormField
            id="dateOfBirth"
            label="Date of birth"
            error={errors.dateOfBirth}
            hint={`Only used to check the minimum age of ${MINIMUM_AGE}.`}
          >
            <Input
              id="dateOfBirth"
              name="dateOfBirth"
              type="date"
              autoComplete="bday"
              value={dateOfBirth}
              onChange={(event) => setDateOfBirth(event.target.value)}
              required
              aria-invalid={Boolean(errors.dateOfBirth)}
              aria-describedby={
                errors.dateOfBirth ? "dateOfBirth-error" : "dateOfBirth-hint"
              }
            />
          </FormField>

          <FormField
            id="password"
            label="Password"
            error={errors.password}
            hint={`At least ${PASSWORD_MIN_LENGTH} characters. Avoid your name or email.`}
          >
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setConfirmationError(null);
              }}
              required
              aria-invalid={Boolean(errors.password)}
              aria-describedby={
                errors.password ? "password-error" : "password-hint"
              }
            />
          </FormField>

          <FormField
            id="confirmPassword"
            label="Confirm password"
            error={confirmationError ?? errors.confirmPassword}
          >
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                setConfirmationError(null);
              }}
              required
              aria-invalid={Boolean(
                confirmationError ?? errors.confirmPassword,
              )}
              aria-describedby={
                confirmationError || errors.confirmPassword
                  ? "confirmPassword-error"
                  : undefined
              }
            />
          </FormField>
        </div>

        {needsGuardian ? (
          <div className="border-border bg-muted/40 space-y-4 rounded-xl border p-4">
            <div>
              <p className="text-sm font-medium">Guardian consent</p>
              <p className="text-muted-foreground mt-1 text-[12.5px] leading-5">
                You&apos;re under 18. Add a parent or guardian so we can email
                them one consent request before your workspace unlocks.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="guardianName"
                label="Guardian's name"
                error={errors.guardianName}
              >
                <Input
                  id="guardianName"
                  name="guardianName"
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
                label="Guardian's email"
                error={errors.guardianEmail}
              >
                <Input
                  id="guardianEmail"
                  name="guardianEmail"
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  required
                  aria-invalid={Boolean(errors.guardianEmail)}
                  aria-describedby={
                    errors.guardianEmail ? "guardianEmail-error" : undefined
                  }
                />
              </FormField>
            </div>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <div className="flex items-start gap-2.5">
            <Checkbox
              id="acceptTerms"
              name="acceptTerms"
              required
              className="mt-0.5"
              aria-invalid={Boolean(errors.acceptTerms)}
              aria-describedby={
                errors.acceptTerms ? "acceptTerms-error" : undefined
              }
            />
            <Label
              htmlFor="acceptTerms"
              className="text-muted-foreground text-[12.5px] leading-5 font-normal"
            >
              I agree to the{" "}
              <Link
                href="/terms"
                target="_blank"
                rel="noreferrer"
                className="text-foreground underline underline-offset-2"
              >
                Terms
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                target="_blank"
                rel="noreferrer"
                className="text-foreground underline underline-offset-2"
              >
                Privacy notice
              </Link>
              .
            </Label>
          </div>
          {errors.acceptTerms ? (
            <p
              id="acceptTerms-error"
              role="alert"
              className="text-[12.5px] text-red-600 dark:text-red-400"
            >
              {errors.acceptTerms}
            </p>
          ) : null}
        </div>

        <SubmitButton
          size="lg"
          className="w-full"
          pendingLabel="Creating account…"
        >
          Create account
          <ArrowRight aria-hidden="true" />
        </SubmitButton>
      </form>

      <p className="text-muted-foreground text-center text-[13px]">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-foreground font-semibold underline underline-offset-2"
        >
          Sign in
        </Link>
      </p>

      <AuthDivider label="or sign up with Google" />
      <GoogleAuthButton intent="sign-up" />
      <p className="text-muted-foreground text-center text-[12px] leading-5">
        Google sign-up still checks your age and terms, then opens your
        EduBridge workspace.
      </p>
    </div>
  );
}
