import { z } from "zod";

import {
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/lib/auth/constants";
import { MINIMUM_AGE, evaluateAgeGate, parseDateOfBirth } from "@/lib/auth/age";
import { BUDGET_CURRENCIES, STUDY_FIELDS } from "@/lib/data/fields";
import { COUNTRY_CODES } from "@/lib/data/countries";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(EMAIL_MAX_LENGTH, "Email address is too long.")
  .pipe(z.email({ error: "Enter a valid email address." }));

const password = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(PASSWORD_MAX_LENGTH, `Use at most ${PASSWORD_MAX_LENGTH} characters.`);

const name = z
  .string()
  .trim()
  .min(2, "Enter your name.")
  .max(NAME_MAX_LENGTH, "Name is too long.");

const country = z.enum(COUNTRY_CODES);

const degreeValues = [
  "BACHELOR",
  "MASTER",
  "PHD",
  "DIPLOMA",
  "CERTIFICATE",
] as const;
const degree = z.enum(degreeValues);

const englishTestValues = [
  "IELTS",
  "TOEFL",
  "PTE",
  "DUOLINGO",
  "CAMBRIDGE",
  "OTHER",
  "NONE",
] as const;
const englishTest = z.enum(englishTestValues);

const dateOfBirth = z
  .string()
  .trim()
  .min(1, "Enter your date of birth.")
  .superRefine((value, ctx) => {
    const parsed = parseDateOfBirth(value);
    if (!parsed) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date." });
      return;
    }
    const gate = evaluateAgeGate(parsed);
    if (gate.status === "invalid") {
      ctx.addIssue({
        code: "custom",
        message: "Date of birth cannot be in the future.",
      });
    } else if (gate.status === "too_young") {
      ctx.addIssue({
        code: "custom",
        message: `You must be at least ${MINIMUM_AGE} to create an account.`,
      });
    }
  });

const registrationFields = {
  email,
  password,
  dateOfBirth,
  guardianName: z.string().trim().max(NAME_MAX_LENGTH).optional(),
  guardianEmail: z.union([z.literal(""), email]).optional(),
  acceptTerms: z.literal(true, {
    error: "Accept the terms and privacy notice to continue.",
  }),
};

function checkGuardianDetails(
  value: {
    email: string;
    dateOfBirth: string;
    guardianName?: string;
    guardianEmail?: string;
  },
  ctx: z.RefinementCtx,
): void {
  const parsed = parseDateOfBirth(value.dateOfBirth);
  if (!parsed) return;

  const gate = evaluateAgeGate(parsed);
  if (gate.status !== "minor") return;

  if (!value.guardianName || value.guardianName.length < 2) {
    ctx.addIssue({
      code: "custom",
      path: ["guardianName"],
      message: "Enter your parent or guardian's name.",
    });
  }
  if (!value.guardianEmail) {
    ctx.addIssue({
      code: "custom",
      path: ["guardianEmail"],
      message: "Enter your parent or guardian's email address.",
    });
  } else if (value.guardianEmail === value.email) {
    ctx.addIssue({
      code: "custom",
      path: ["guardianEmail"],
      message: "Use a different email address for your guardian.",
    });
  }
}

/** Service- and Server Action-level schema. Both password fields are submitted. */
export const registerSchema = z
  .object({ name, ...registrationFields, confirmPassword: z.string() })
  .superRefine((value, ctx) => {
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords do not match.",
      });
    }
    checkGuardianDetails(value, ctx);
  });

/** Legacy schema retained for validation coverage; the current form posts `confirmPassword` too. */
export const registerFormSchema = z
  .object({ name, ...registrationFields })
  .superRefine(checkGuardianDetails);

export type RegisterInput = z.infer<typeof registerSchema>;
export type RegisterFormInput = z.infer<typeof registerFormSchema>;

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password.").max(PASSWORD_MAX_LENGTH),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20),
    password,
    confirmPassword: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords do not match.",
      });
    }
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    password,
    confirmPassword: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords do not match.",
      });
    }
    if (value.currentPassword === value.password) {
      ctx.addIssue({
        code: "custom",
        path: ["password"],
        message: "Choose a password you have not used before.",
      });
    }
  });

/**
 * Accepts either a 6-digit TOTP code or a formatted recovery code. Kept
 * permissive about separators so a pasted recovery code is not rejected.
 */
export const mfaCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .max(64)
    .refine(
      (value) =>
        /^\d{6}$/.test(value) ||
        /^[a-f0-9]{4}([- ]?[a-f0-9]{4}){3}$/i.test(value),
      "Enter a 6-digit code or a recovery code.",
    ),
});

export const mfaConfirmSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app."),
});

export const tokenSchema = z.object({ token: z.string().min(20) });

export const guardianDecisionSchema = z.object({
  token: z.string().min(20),
  decision: z.enum(["approve", "decline"]),
});

export const guardianContactSchema = z.object({
  guardianName: z
    .string()
    .trim()
    .min(2, "Enter your parent or guardian's name.")
    .max(NAME_MAX_LENGTH, "Name is too long."),
  guardianEmail: email,
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Enter your password."),
  confirmation: z.literal("DELETE", {
    error: "Type DELETE to confirm.",
  }),
});

export const revokeSessionSchema = z.object({
  sessionId: z.string().min(10),
});

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "Value is too long.")
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null));

export const profileSchema = z.object({
  name,
  nationality: z.union([z.literal(""), country]).optional(),
  residenceCountry: z.union([z.literal(""), country]).optional(),
  currentDegree: z.union([z.literal(""), degree]).optional(),
  targetDegree: z.union([z.literal(""), degree]).optional(),
  fieldsOfStudy: z
    .array(z.enum(STUDY_FIELDS))
    .max(6, "Choose at most six fields.")
    .optional(),
  englishTest: z.union([z.literal(""), englishTest]).optional(),
  englishScore: optionalText(40),
  budgetAmount: optionalText(20),
  budgetCurrency: z
    .union([z.literal(""), z.enum(BUDGET_CURRENCIES)])
    .optional(),
  guardianName: optionalText(NAME_MAX_LENGTH),
  guardianEmail: z
    .union([z.literal(""), email])
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export type ProfileInput = z.infer<typeof profileSchema>;

export const BUDGET_MIN_AMOUNT = 1;
export const BUDGET_MAX_AMOUNT = 1_000_000_000;

/** Parses a whole-number budget amount from a form field. */
export function parseBudgetAmount(
  value: string | null | undefined,
): number | null {
  if (!value) return null;
  const normalized = value.replace(/[\s,]/g, "");
  if (!/^\d{1,10}$/.test(normalized)) return null;
  const amount = Number(normalized);
  if (amount < BUDGET_MIN_AMOUNT || amount > BUDGET_MAX_AMOUNT) return null;
  return amount;
}

/** Maps a Zod error to a stable `field -> first message` shape. */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}
