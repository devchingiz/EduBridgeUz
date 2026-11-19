"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

export function GoogleAuthButton({
  intent,
}: {
  intent: "sign-in" | "sign-up";
}) {
  const [error, setError] = useState("");

  function startSignUp() {
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

  return (
    <div className="space-y-2">
      {intent === "sign-in" ? (
        <Button asChild type="button" variant="outline" className="w-full">
          <a href="/api/auth/google/start">
            <span
              aria-hidden="true"
              className="text-base font-semibold text-[#4285f4]"
            >
              G
            </span>
            Continue with Google
          </a>
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={startSignUp}
        >
          <span
            aria-hidden="true"
            className="text-base font-semibold text-[#4285f4]"
          >
            G
          </span>
          Continue with Google
        </Button>
      )}
      {error ? (
        <p
          role="alert"
          className="text-[12.5px] text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
