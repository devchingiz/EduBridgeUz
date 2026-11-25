"use client";

import { AlertCircle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[18px]">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

export function GoogleAuthButton({
  intent,
}: {
  intent: "sign-in" | "sign-up";
}) {
  const [error, setError] = useState("");

  function startSignUp() {
    setError("");
    const dateOfBirth = document.querySelector<HTMLInputElement>(
      '[name="dateOfBirth"]',
    );
    const terms = document.querySelector<HTMLInputElement>(
      '[name="acceptTerms"]',
    );

    if (!dateOfBirth?.reportValidity()) return;
    if (!terms?.checked) {
      setError("Accept the terms and privacy notice to continue.");
      terms?.focus();
      return;
    }

    const values: Record<string, string> = {
      intent: "SIGN_UP",
      dateOfBirth: dateOfBirth.value,
      acceptTerms: "on",
    };
    for (const name of ["guardianName", "guardianEmail"]) {
      const input = document.querySelector<HTMLInputElement>(
        `[name="${name}"]`,
      );
      if (input) values[name] = input.value;
    }

    const form = document.createElement("form");
    form.method = "post";
    form.action = "/api/auth/google/start";
    form.hidden = true;
    for (const [name, value] of Object.entries(values)) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.append(input);
    }
    document.body.append(form);
    form.submit();
  }

  const label =
    intent === "sign-in" ? "Continue with Google" : "Sign up with Google";

  return (
    <div className="space-y-2">
      {intent === "sign-in" ? (
        <Button
          asChild
          variant="outline"
          size="lg"
          className="w-full justify-center"
        >
          <a href="/api/auth/google/start">
            <GoogleIcon />
            {label}
          </a>
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full justify-center"
          aria-describedby={error ? "google-auth-error" : undefined}
          onClick={startSignUp}
        >
          <GoogleIcon />
          {label}
        </Button>
      )}
      {error ? (
        <p
          id="google-auth-error"
          role="alert"
          className="flex items-center gap-1.5 text-[12.5px] text-red-600 dark:text-red-400"
        >
          <AlertCircle aria-hidden="true" className="size-3.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
