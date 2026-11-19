"use server";

import { revalidatePath } from "next/cache";

import { errorState, successState, type FormState } from "@/lib/actions/state";
import { requireWorkspace } from "@/lib/auth/dal";
import { recordAuditEvent } from "@/lib/auth/audit";
import {
  clearAdvisorHistory,
  deleteAdvisorConversation,
  setAdvisorMessageFeedback,
} from "@/lib/advisor/service";
import {
  advisorFeedbackSchema,
  advisorIdSchema,
} from "@/lib/advisor/validation";
import { assertSameOrigin, getRequestContext } from "@/lib/http/request";

async function advisorActionContext() {
  await assertSameOrigin();
  const session = await requireWorkspace();
  return { session, context: await getRequestContext() };
}

function invalidId(): FormState {
  return errorState("That conversation could not be found.");
}

export async function deleteAdvisorConversationAction(
  conversationId: string,
): Promise<FormState> {
  const { session, context } = await advisorActionContext();
  const parsed = advisorIdSchema.safeParse(conversationId);
  if (!parsed.success) return invalidId();

  const deleted = await deleteAdvisorConversation(session.user.id, parsed.data);
  if (!deleted) return invalidId();

  await recordAuditEvent({
    actorId: session.user.id,
    action: "advisor.conversation.delete",
    entityType: "AdvisorConversation",
    entityId: parsed.data,
    metadata: { scope: "user" },
    ip: context.ip,
  });

  revalidatePath("/dashboard/advisor");
  return successState("Conversation deleted.");
}

export async function clearAdvisorHistoryAction(): Promise<FormState> {
  const { session, context } = await advisorActionContext();
  await clearAdvisorHistory(session.user.id);

  await recordAuditEvent({
    actorId: session.user.id,
    action: "advisor.history.clear",
    entityType: "AdvisorConversation",
    entityId: session.user.id,
    metadata: { scope: "all" },
    ip: context.ip,
  });

  revalidatePath("/dashboard/advisor");
  return successState("Advisor history cleared.");
}

export async function setAdvisorFeedbackAction(
  messageId: string,
  feedback: string,
): Promise<FormState> {
  await assertSameOrigin();
  const session = await requireWorkspace();
  const ids = advisorIdSchema.safeParse(messageId);
  const value = advisorFeedbackSchema.safeParse(feedback);
  if (!ids.success || !value.success) {
    return errorState("Thanks, but that response could not be updated.");
  }

  const updated = await setAdvisorMessageFeedback(
    session.user.id,
    ids.data,
    value.data,
  );
  if (!updated) {
    return errorState("Thanks, but that response could not be updated.");
  }

  revalidatePath("/dashboard/advisor");
  return successState("Thanks for your feedback.");
}
