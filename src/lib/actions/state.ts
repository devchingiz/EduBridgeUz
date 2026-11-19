/**
 * Serialisable state shared by `useActionState` forms and their Server Actions.
 * Keep it small: every field crosses the server/client boundary.
 */
export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const initialFormState: FormState = { status: "idle" };

export function errorState(
  message: string,
  fieldErrors?: Record<string, string>,
): FormState {
  return { status: "error", message, fieldErrors };
}

export function successState(message: string): FormState {
  return { status: "success", message };
}

/** Rate-limit message shown without revealing which counter was hit. */
export function rateLimitState(retryAfterSeconds: number): FormState {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return errorState(
    `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
  );
}
