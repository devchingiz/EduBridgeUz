import "server-only";

import { z } from "zod";

/**
 * The browser never controls the model, provider, tools, or user scope. This
 * schema deliberately accepts only a conversation reference and student text.
 */
export function advisorChatRequestSchema(maxInputChars: number) {
  return z
    .object({
      conversationId: z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9_-]{1,64}$/)
        .optional(),
      message: z
        .string()
        .trim()
        .max(maxInputChars)
        .refine(
          (value) =>
            !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value),
          { message: "Control characters are not allowed." },
        ),
      regenerate: z.boolean().optional().default(false),
    })
    .strict()
    .superRefine((value, context) => {
      if (!value.regenerate && value.message.length === 0) {
        context.addIssue({
          code: "custom",
          path: ["message"],
          message: "Enter a message.",
        });
      }
    });
}

export type AdvisorChatInput = {
  conversationId?: string;
  message: string;
  regenerate: boolean;
};

export function parseAdvisorChatRequest(
  value: unknown,
  maxInputChars: number,
): AdvisorChatInput {
  const result = advisorChatRequestSchema(maxInputChars).safeParse(value);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new Error(first?.message ?? "Invalid advisor request.");
  }
  return {
    ...(result.data.conversationId
      ? { conversationId: result.data.conversationId }
      : {}),
    message: result.data.message,
    regenerate: result.data.regenerate,
  };
}

export const advisorIdSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{1,64}$/);

export const advisorFeedbackSchema = z.enum(["HELPFUL", "UNHELPFUL"]);
