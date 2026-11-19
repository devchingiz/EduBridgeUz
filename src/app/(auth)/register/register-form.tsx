"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { registerAction } from "@/app/(auth)/actions";
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

  const parsed = dateOfBirth ? parseDateOfBirth(dateOfBirth) : null;
  const needsGuardian = parsed
    ? evaluateAgeGate(parsed).status === "minor"
    : false;
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />

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
          required
          aria-invalid={Boolean(errors.password)}
          aria-describedby={
            errors.password ? "password-error" : "password-hint"
          }
        />
      </FormField>

      {needsGuardian ? (
        <div className="border-border bg-muted/40 space-y-4 rounded-xl border p-4">
          <div>
            <p className="text-sm font-medium">Guardian consent</p>
            <p className="text-muted-foreground mt-1 text-[12.5px] leading-5">
              You&apos;re under 18. Add a parent or guardian so we can email
              them one consent request before your workspace unlocks.
            </p>
          </div>

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

      <SubmitButton className="w-full" pendingLabel="Creating account…">
        Create account
      </SubmitButton>

      <p className="text-muted-foreground text-center text-[13px]">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-foreground font-medium underline underline-offset-2"
        >
          Sign in
        </Link>
      </p>

      <div className="text-muted-foreground flex items-center gap-3 text-[11px]">
        <span className="bg-border h-px flex-1" />
        <span>or</span>
        <span className="bg-border h-px flex-1" />
      </div>
      <GoogleAuthButton intent="sign-up" />
    </form>
  );
}
