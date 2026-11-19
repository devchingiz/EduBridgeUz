-- AI advisor: private conversations, messages, and a metadata-only usage ledger.

CREATE TYPE "AdvisorMessageRole" AS ENUM ('USER', 'ASSISTANT');

CREATE TYPE "AdvisorFeedback" AS ENUM ('HELPFUL', 'UNHELPFUL');

CREATE TYPE "AdvisorRequestOutcome" AS ENUM ('SUCCESS', 'PROVIDER_ERROR', 'TIMEOUT', 'RATE_LIMITED', 'BLOCKED');

CREATE TABLE "AdvisorConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New conversation',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvisorConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdvisorMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "AdvisorMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "model" TEXT,
    "citations" JSONB,
    "toolNames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "feedback" "AdvisorFeedback",
    "feedbackAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvisorMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdvisorUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostMicros" INTEGER NOT NULL DEFAULT 0,
    "outcome" "AdvisorRequestOutcome" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvisorUsage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdvisorConversation_userId_updatedAt_idx" ON "AdvisorConversation"("userId", "updatedAt");

CREATE INDEX "AdvisorMessage_conversationId_createdAt_idx" ON "AdvisorMessage"("conversationId", "createdAt");

CREATE INDEX "AdvisorUsage_userId_createdAt_idx" ON "AdvisorUsage"("userId", "createdAt");

CREATE INDEX "AdvisorUsage_createdAt_idx" ON "AdvisorUsage"("createdAt");

ALTER TABLE "AdvisorConversation" ADD CONSTRAINT "AdvisorConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdvisorMessage" ADD CONSTRAINT "AdvisorMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AdvisorConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdvisorUsage" ADD CONSTRAINT "AdvisorUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdvisorUsage" ADD CONSTRAINT "AdvisorUsage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AdvisorConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
