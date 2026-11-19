import "server-only";

import {
  AdvisorFeedback,
  AdvisorMessageRole,
  type AdvisorMessage,
  type Prisma,
} from "@prisma/client";

import {
  type AdvisorCitation,
  type AdvisorConversationDTO,
  type AdvisorFeedbackValue,
  type AdvisorMessageDTO,
  type AdvisorMessageRoleValue,
} from "@/lib/advisor/types";
import { db } from "@/lib/db";
import type { AdvisorProviderTurn } from "@/lib/advisor/providers/types";

const MAX_CONVERSATIONS = 50;
const MAX_CITATIONS = 10;

function iso(value: Date): string {
  return value.toISOString();
}

function parseCitations(value: Prisma.JsonValue | null): AdvisorCitation[] {
  if (!Array.isArray(value)) return [];

  const citations: AdvisorCitation[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const url = typeof record.url === "string" ? record.url.trim() : "";
    const title = typeof record.title === "string" ? record.title.trim() : "";
    const verifiedAt =
      typeof record.verifiedAt === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(record.verifiedAt)
        ? record.verifiedAt
        : null;
    if (!/^https?:\/\//i.test(url) || !title) continue;
    citations.push({ url, title: title.slice(0, 120), verifiedAt });
  }
  return citations.slice(0, MAX_CITATIONS);
}

export function toAdvisorMessageDTO(
  message: AdvisorMessage,
): AdvisorMessageDTO {
  return {
    id: message.id,
    role: message.role as AdvisorMessageRoleValue,
    content: message.content,
    model: message.model,
    citations: parseCitations(message.citations),
    feedback: (message.feedback as AdvisorFeedbackValue | null) ?? null,
    createdAt: iso(message.createdAt),
  };
}

function conversationDTO(conversation: {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  _count?: { messages: number };
}): AdvisorConversationDTO {
  return {
    id: conversation.id,
    title: conversation.title,
    createdAt: iso(conversation.createdAt),
    updatedAt: iso(conversation.updatedAt),
    messageCount: conversation._count?.messages ?? 0,
  };
}

/** Deterministic title from the first student message; no extra model call. */
export function advisorConversationTitle(message: string): string {
  const cleaned = message
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "New conversation";
  return cleaned.length > 60 ? `${cleaned.slice(0, 59).trimEnd()}…` : cleaned;
}

export async function listAdvisorConversations(
  userId: string,
): Promise<AdvisorConversationDTO[]> {
  const rows = await db.advisorConversation.findMany({
    where: { userId },
    include: { _count: { select: { messages: true } } },
    orderBy: { updatedAt: "desc" },
    take: MAX_CONVERSATIONS,
  });
  return rows.map(conversationDTO);
}

export async function getAdvisorConversation(
  userId: string,
  conversationId: string,
): Promise<{
  conversation: AdvisorConversationDTO;
  messages: AdvisorMessageDTO[];
} | null> {
  const row = await db.advisorConversation.findFirst({
    where: { id: conversationId, userId },
    include: {
      _count: { select: { messages: true } },
      messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
    },
  });
  if (!row) return null;

  return {
    conversation: conversationDTO(row),
    messages: row.messages.map(toAdvisorMessageDTO),
  };
}

export async function createAdvisorConversation(
  userId: string,
  title: string,
  now = new Date(),
): Promise<AdvisorConversationDTO> {
  const row = await db.advisorConversation.create({
    data: {
      userId,
      title: advisorConversationTitle(title),
      createdAt: now,
      updatedAt: now,
    },
    include: { _count: { select: { messages: true } } },
  });
  return conversationDTO(row);
}

type AppendMessageInput = {
  role: AdvisorMessageRoleValue;
  content: string;
  model?: string | null;
  citations?: AdvisorCitation[];
  toolNames?: string[];
  createdAt?: Date;
};

/**
 * Appends a message only after verifying that the conversation belongs to the
 * authenticated user. Ownership is never inferred from the client DTO.
 */
export async function appendAdvisorMessage(
  userId: string,
  conversationId: string,
  input: AppendMessageInput,
): Promise<AdvisorMessageDTO | null> {
  const result = await db.$transaction(async (tx) => {
    const conversation = await tx.advisorConversation.findFirst({
      where: { id: conversationId, userId },
      select: { id: true },
    });
    if (!conversation) return null;

    const message = await tx.advisorMessage.create({
      data: {
        conversationId,
        role:
          input.role === "USER"
            ? AdvisorMessageRole.USER
            : AdvisorMessageRole.ASSISTANT,
        content: input.content,
        model: input.model ?? null,
        citations:
          input.citations && input.citations.length > 0
            ? (input.citations as unknown as Prisma.InputJsonValue)
            : undefined,
        toolNames: input.toolNames ?? [],
        createdAt: input.createdAt ?? new Date(),
      },
    });
    await tx.advisorConversation.update({
      where: { id: conversationId },
      data: { updatedAt: input.createdAt ?? new Date() },
    });
    return message;
  });

  return result ? toAdvisorMessageDTO(result) : null;
}

/**
 * Converts prior, trusted conversation messages into provider turns. Tool
 * results are deliberately not persisted as messages: only the final answer is
 * shown, while sources are stored as validated citations.
 */
export async function getAdvisorHistoryTurns(
  conversationId: string,
  limit: number,
  excludeMessageId?: string,
): Promise<AdvisorProviderTurn[]> {
  const rows = await db.advisorMessage.findMany({
    where: {
      conversationId,
      ...(excludeMessageId ? { id: { not: excludeMessageId } } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select: { role: true, content: true },
  });

  return rows
    .reverse()
    .map((row) =>
      row.role === AdvisorMessageRole.USER
        ? ({ role: "user", content: row.content } as const)
        : ({ role: "assistant", content: row.content, toolCalls: [] } as const),
    );
}

/**
 * Removes assistant answers after the last student message and returns that
 * message plus the remaining history. Used by "regenerate response".
 */
export async function prepareAdvisorRegeneration(
  userId: string,
  conversationId: string,
  contextLimit: number,
): Promise<{
  userMessage: AdvisorMessageDTO;
  history: AdvisorProviderTurn[];
} | null> {
  const result = await db.$transaction(async (tx) => {
    const conversation = await tx.advisorConversation.findFirst({
      where: { id: conversationId, userId },
      select: { id: true },
    });
    if (!conversation) return null;

    const messages = await tx.advisorMessage.findMany({
      where: { conversationId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    let lastUserIndex = -1;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === AdvisorMessageRole.USER) {
        lastUserIndex = index;
        break;
      }
    }
    if (lastUserIndex < 0) return null;

    const stale = messages
      .slice(lastUserIndex + 1)
      .map((message) => message.id);
    if (stale.length > 0) {
      await tx.advisorMessage.deleteMany({
        where: { id: { in: stale }, conversationId },
      });
    }

    return {
      userMessage: toAdvisorMessageDTO(messages[lastUserIndex]),
      history: messages
        .slice(0, lastUserIndex)
        .map((message): AdvisorProviderTurn =>
          message.role === AdvisorMessageRole.USER
            ? { role: "user", content: message.content }
            : { role: "assistant", content: message.content, toolCalls: [] },
        ),
    };
  });

  if (!result) return null;
  return {
    userMessage: result.userMessage,
    history: result.history.slice(-contextLimit),
  };
}

export type AdvisorUsageRecord = {
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostMicros: number;
  outcome:
    "SUCCESS" | "PROVIDER_ERROR" | "TIMEOUT" | "RATE_LIMITED" | "BLOCKED";
};

export async function recordAdvisorUsage(
  userId: string,
  record: AdvisorUsageRecord,
  conversationId?: string | null,
): Promise<void> {
  await db.advisorUsage.create({
    data: {
      userId,
      conversationId: conversationId ?? null,
      provider: record.provider,
      model: record.model,
      promptTokens: Math.max(0, record.promptTokens),
      completionTokens: Math.max(0, record.completionTokens),
      totalTokens: Math.max(0, record.totalTokens),
      estimatedCostMicros: Math.max(0, record.estimatedCostMicros),
      outcome: record.outcome,
    },
  });
}

export async function getAdvisorDailyUsage(
  userId: string,
  since: Date,
): Promise<{
  successfulMessages: number;
  promptTokens: number;
  completionTokens: number;
  estimatedCostMicros: number;
}> {
  const [aggregate, successful] = await Promise.all([
    db.advisorUsage.aggregate({
      where: { userId, createdAt: { gte: since } },
      _sum: {
        promptTokens: true,
        completionTokens: true,
        estimatedCostMicros: true,
      },
    }),
    db.advisorUsage.count({
      where: { userId, createdAt: { gte: since }, outcome: "SUCCESS" },
    }),
  ]);

  return {
    successfulMessages: successful,
    promptTokens: aggregate._sum.promptTokens ?? 0,
    completionTokens: aggregate._sum.completionTokens ?? 0,
    estimatedCostMicros: aggregate._sum.estimatedCostMicros ?? 0,
  };
}

export async function getGlobalDailyAdvisorCostMicros(
  since: Date,
): Promise<number> {
  const aggregate = await db.advisorUsage.aggregate({
    where: { createdAt: { gte: since } },
    _sum: { estimatedCostMicros: true },
  });
  return aggregate._sum.estimatedCostMicros ?? 0;
}

export async function setAdvisorMessageFeedback(
  userId: string,
  messageId: string,
  feedback: AdvisorFeedbackValue,
): Promise<boolean> {
  const result = await db.advisorMessage.updateMany({
    where: {
      id: messageId,
      role: AdvisorMessageRole.ASSISTANT,
      conversation: { userId },
    },
    data: {
      feedback:
        feedback === "HELPFUL"
          ? AdvisorFeedback.HELPFUL
          : AdvisorFeedback.UNHELPFUL,
      feedbackAt: new Date(),
    },
  });
  return result.count > 0;
}

export async function deleteAdvisorConversation(
  userId: string,
  conversationId: string,
): Promise<boolean> {
  const result = await db.advisorConversation.deleteMany({
    where: { id: conversationId, userId },
  });
  return result.count > 0;
}

export async function clearAdvisorHistory(userId: string): Promise<number> {
  const result = await db.advisorConversation.deleteMany({ where: { userId } });
  return result.count;
}
