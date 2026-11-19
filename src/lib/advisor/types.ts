export type AdvisorCitation = {
  url: string;
  title: string;
  /** ISO date (YYYY-MM-DD) of the last human verification, if any. */
  verifiedAt: string | null;
};

export type AdvisorSource = AdvisorCitation;

export type AdvisorConversationDTO = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
};

export type AdvisorMessageRoleValue = "USER" | "ASSISTANT";
export type AdvisorFeedbackValue = "HELPFUL" | "UNHELPFUL";

export type AdvisorMessageDTO = {
  id: string;
  role: AdvisorMessageRoleValue;
  content: string;
  model: string | null;
  citations: AdvisorCitation[];
  feedback: AdvisorFeedbackValue | null;
  createdAt: string;
};

export type AdvisorChatResponse = {
  conversationId: string;
  title: string;
  message: AdvisorMessageDTO;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostMicros: number;
  };
};

export type AdvisorStatusDTO = {
  enabled: boolean;
  provider: string | null;
  model: string | null;
  reason: "missing_key" | "misconfigured" | null;
};

export type AdvisorErrorResponse = {
  error: {
    code: string;
    message: string;
    retryAfterSeconds?: number;
    conversationId?: string;
  };
};
