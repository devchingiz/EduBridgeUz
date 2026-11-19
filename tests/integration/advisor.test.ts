import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { AdvisorConfig } from "@/lib/advisor/config";
import { handleAdvisorChat } from "@/lib/advisor/chat";
import {
  AdvisorProviderError,
  type AdvisorChatProvider,
  type AdvisorProviderRequest,
  type AdvisorProviderResponse,
  type AdvisorToolCall,
} from "@/lib/advisor/providers/types";
import {
  clearAdvisorHistory,
  deleteAdvisorConversation,
  getAdvisorConversation,
  listAdvisorConversations,
  setAdvisorMessageFeedback,
} from "@/lib/advisor/service";
import { db } from "@/lib/db";

let studentId = "";
let otherStudentId = "";
let universityId = "";

const NOW = new Date("2026-11-17T12:00:00.000Z");
const USAGE = { promptTokens: 100, completionTokens: 40, totalTokens: 140 };

function config(overrides: Partial<AdvisorConfig> = {}): AdvisorConfig {
  return {
    enabled: true,
    provider: "openai",
    model: "gpt-4.1-mini",
    apiKey: "test-key",
    baseUrl: "https://api.openai.com/v1",
    timeoutMs: 30_000,
    maxOutputTokens: 1_200,
    maxContextMessages: 16,
    maxInputChars: 4_000,
    maxToolRounds: 4,
    maxToolsPerRound: 5,
    messagesPerMinute: 60,
    dailyUserMessages: 500,
    dailyUserCostMicros: 10_000_000,
    dailyGlobalCostMicros: 100_000_000,
    pricing: { inputPerMillion: 0.4, outputPerMillion: 1.6 },
    ...overrides,
  };
}

function textResponse(text: string): AdvisorProviderResponse {
  return {
    text,
    toolCalls: [],
    usage: USAGE,
    finishReason: "stop",
  };
}

function toolResponse(toolCalls: AdvisorToolCall[]): AdvisorProviderResponse {
  return {
    text: "",
    toolCalls,
    usage: USAGE,
    finishReason: "tool_calls",
  };
}

function mockProvider(
  responses: AdvisorProviderResponse[],
  captured: AdvisorProviderRequest[] = [],
): AdvisorChatProvider {
  let index = 0;
  return {
    id: "mock-provider",
    model: "mock-model",
    async complete(request: AdvisorProviderRequest) {
      captured.push(request);
      const next = responses[index] ?? responses[responses.length - 1];
      if (!next) throw new Error("Mock provider has no response configured.");
      index += 1;
      return next;
    },
  };
}

beforeEach(async () => {
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE "AdvisorUsage", "AdvisorMessage", "AdvisorConversation", "StudentNotification", "NotificationPreference", "ApplicationDocument", "StudentDocument", "ApplicationStatusEvent", "Application", "UniversityFavorite", "ScholarshipFavorite", "CatalogReview", "Requirement", "TuitionFact", "DeadlineFact", "ProgramCost", "ProgramIntake", "ProgramScholarship", "Program", "Scholarship", "University", "SourceCitation", "AuditEvent", "RateLimitCounter", "ConsentRecord", "AuthToken", "Session", "StudentProfile", "User" RESTART IDENTITY CASCADE',
  );

  const [student, otherStudent] = await Promise.all([
    db.user.create({
      data: {
        email: "advisor-student@example.test",
        name: "Advisor Student",
        emailVerifiedAt: NOW,
      },
      select: { id: true },
    }),
    db.user.create({
      data: {
        email: "advisor-other@example.test",
        name: "Other Student",
        emailVerifiedAt: NOW,
      },
      select: { id: true },
    }),
  ]);
  studentId = student.id;
  otherStudentId = otherStudent.id;

  await db.studentProfile.create({
    data: {
      userId: studentId,
      nationality: "DE",
      residenceCountry: "DE",
      targetDegree: "MASTER",
      fieldsOfStudy: ["Computer Science"],
      budgetAmount: 15_000,
      budgetCurrency: "EUR",
      onboardingCompletedAt: NOW,
    },
  });

  const citation = await db.sourceCitation.create({
    data: {
      url: "https://example.edu/admissions",
      publisher: "Example University",
      title: "Official admissions page",
      accessedAt: new Date("2026-11-16T00:00:00.000Z"),
      verifiedAt: new Date("2026-11-16T00:00:00.000Z"),
    },
    select: { id: true },
  });
  const university = await db.university.create({
    data: {
      slug: "example-university",
      name: "Example University",
      city: "Berlin",
      countryCode: "DE",
      websiteUrl: "https://example.edu/",
      verificationStatus: "VERIFIED",
      lastVerifiedAt: new Date("2026-11-16T00:00:00.000Z"),
      primarySourceId: citation.id,
    },
    select: { id: true },
  });
  universityId = university.id;

  await db.program.create({
    data: {
      universityId,
      slug: "msc-computer-science",
      name: "MSc Computer Science",
      degreeLevel: "MASTER",
      field: "Computer Science",
      language: "en",
      verificationStatus: "VERIFIED",
      lastVerifiedAt: new Date("2026-11-16T00:00:00.000Z"),
      primarySourceId: citation.id,
    },
  });

  await db.application.create({
    data: {
      userId: studentId,
      universityId,
      status: "INTERESTED",
      notes: "STUDENT_PRIVATE_NOTE",
      deadline: new Date("2026-12-15T00:00:00.000Z"),
      progress: 25,
    },
  });
  await db.application.create({
    data: {
      userId: otherStudentId,
      universityId,
      status: "INTERESTED",
      notes: "OTHER_PRIVATE_NOTE",
      deadline: new Date("2026-12-20T00:00:00.000Z"),
      progress: 10,
    },
  });
});

afterAll(async () => {
  await db.$disconnect();
});

describe("advisor orchestration", () => {
  it("persists a conversation, message history, and metadata-only usage for the owner", async () => {
    const captured: AdvisorProviderRequest[] = [];
    const result = await handleAdvisorChat(
      studentId,
      { message: "What should I do next?", regenerate: false },
      {
        config: config(),
        providerFactory: () =>
          mockProvider([textResponse("Start with your documents.")], captured),
        now: () => NOW,
      },
    );

    expect(result.conversationId).toBeTruthy();
    expect(result.title).toBe("What should I do next?");
    expect(result.message.role).toBe("ASSISTANT");
    expect(result.message.content).toBe("Start with your documents.");
    expect(result.usage).toMatchObject({
      promptTokens: 100,
      completionTokens: 40,
      totalTokens: 140,
      estimatedCostMicros: 104,
    });

    const stored = await getAdvisorConversation(
      studentId,
      result.conversationId,
    );
    expect(stored?.messages.map((message) => message.role)).toEqual([
      "USER",
      "ASSISTANT",
    ]);
    expect(stored?.messages[1].model).toBe("gpt-4.1-mini");

    expect(captured[0].turns[0].content).toContain("private_student_context");
    expect(captured[0].turns[0].content).toContain("Germany");
    expect(captured[0].turns.at(-1)).toEqual({
      role: "user",
      content: "<student_message>\nWhat should I do next?\n</student_message>",
    });

    expect(
      await getAdvisorConversation(otherStudentId, result.conversationId),
    ).toBeNull();
    expect(await listAdvisorConversations(otherStudentId)).toEqual([]);

    const usage = await db.advisorUsage.findMany({
      where: { userId: studentId },
    });
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({
      provider: "openai",
      model: "gpt-4.1-mini",
      outcome: "SUCCESS",
      promptTokens: 100,
      completionTokens: 40,
    });
    expect(JSON.stringify(usage)).not.toContain("What should I do next?");
  });

  it("executes tools with the session user and strips fabricated source links", async () => {
    const captured: AdvisorProviderRequest[] = [];
    const result = await handleAdvisorChat(
      studentId,
      {
        message: "Find a program and check my applications.",
        regenerate: false,
      },
      {
        config: config(),
        providerFactory: () =>
          mockProvider(
            [
              toolResponse([
                {
                  id: "call_apps",
                  name: "list_applications",
                  arguments: "{}",
                },
                {
                  id: "call_search",
                  name: "search_universities",
                  arguments: JSON.stringify({ query: "Example", limit: 1 }),
                },
              ]),
              textResponse(
                "Based on [the catalog](https://example.edu/admissions), also see https://fake-university.test/tuition.",
              ),
            ],
            captured,
          ),
        now: () => NOW,
      },
    );

    const toolTurns = captured
      .flatMap((call) => call.turns)
      .filter((turn) => turn.role === "tool");
    const applicationsTool = toolTurns.find(
      (turn) => turn.role === "tool" && turn.name === "list_applications",
    );
    expect(applicationsTool?.content).toContain("STUDENT_PRIVATE_NOTE");
    expect(applicationsTool?.content).not.toContain("OTHER_PRIVATE_NOTE");

    expect(result.message.content).toContain(
      "[the catalog](https://example.edu/admissions)",
    );
    expect(result.message.content).toContain("[unverified link removed]");
    expect(result.message.content).not.toContain("fake-university.test");
    expect(result.message.content).toContain("Sources from EduBridge catalog");
    expect(result.message.citations).toEqual([
      {
        url: "https://example.edu/admissions",
        title: "Official admissions page",
        verifiedAt: "2026-11-16",
      },
    ]);

    const storedMessage = await db.advisorMessage.findFirstOrThrow({
      where: { id: result.message.id },
    });
    expect(storedMessage.toolNames.sort()).toEqual([
      "list_applications",
      "search_universities",
    ]);
  });

  it("regenerates the last answer without duplicating the student message", async () => {
    const first = await handleAdvisorChat(
      studentId,
      { message: "Explain my next step.", regenerate: false },
      {
        config: config(),
        providerFactory: () => mockProvider([textResponse("Original answer.")]),
        now: () => NOW,
      },
    );

    const regenerated = await handleAdvisorChat(
      studentId,
      {
        message: "ignored",
        conversationId: first.conversationId,
        regenerate: true,
      },
      {
        config: config(),
        providerFactory: () =>
          mockProvider([textResponse("Regenerated answer.")]),
        now: () => NOW,
      },
    );

    expect(regenerated.conversationId).toBe(first.conversationId);
    expect(regenerated.message.content).toBe("Regenerated answer.");

    const conversation = await getAdvisorConversation(
      studentId,
      first.conversationId,
    );
    expect(conversation?.messages.map((message) => message.role)).toEqual([
      "USER",
      "ASSISTANT",
    ]);
    expect(conversation?.messages[0].content).toBe("Explain my next step.");
    expect(conversation?.messages[1].content).toBe("Regenerated answer.");
    expect(await db.advisorUsage.count({ where: { userId: studentId } })).toBe(
      2,
    );
  });

  it("keeps the user message and records a timeout when the provider fails", async () => {
    const failingProvider: AdvisorChatProvider = {
      id: "mock-provider",
      model: "mock-model",
      async complete() {
        throw new AdvisorProviderError("provider_timeout", "Timed out.");
      },
    };

    await expect(
      handleAdvisorChat(
        studentId,
        { message: "Hello advisor", regenerate: false },
        {
          config: config(),
          providerFactory: () => failingProvider,
          now: () => NOW,
        },
      ),
    ).rejects.toMatchObject({
      code: "provider_timeout",
      message: "The AI provider took too long to respond. Try again.",
    });

    const conversations = await listAdvisorConversations(studentId);
    expect(conversations).toHaveLength(1);
    const stored = await getAdvisorConversation(studentId, conversations[0].id);
    expect(stored?.messages.map((message) => message.role)).toEqual(["USER"]);

    const usage = await db.advisorUsage.findFirstOrThrow();
    expect(usage.outcome).toBe("TIMEOUT");
    expect(usage.totalTokens).toBe(0);
  });

  it("enforces per-minute rate limits and daily cost caps with ledger entries", async () => {
    const throttled = config({ messagesPerMinute: 1 });
    await handleAdvisorChat(
      studentId,
      { message: "First question", regenerate: false },
      {
        config: throttled,
        providerFactory: () => mockProvider([textResponse("First answer.")]),
        now: () => NOW,
      },
    );

    await expect(
      handleAdvisorChat(
        studentId,
        { message: "Second question", regenerate: false },
        {
          config: throttled,
          providerFactory: () => mockProvider([textResponse("Second answer.")]),
          now: () => NOW,
        },
      ),
    ).rejects.toMatchObject({ code: "rate_limited" });

    expect(
      await db.advisorUsage.count({
        where: { outcome: "RATE_LIMITED" },
      }),
    ).toBe(1);

    await db.rateLimitCounter.deleteMany();
    await db.advisorUsage.deleteMany();

    const capped = config({ dailyUserCostMicros: 1 });
    await handleAdvisorChat(
      studentId,
      { message: "First capped question", regenerate: false },
      {
        config: capped,
        providerFactory: () => mockProvider([textResponse("Answer.")]),
        now: () => NOW,
      },
    );
    await expect(
      handleAdvisorChat(
        studentId,
        { message: "Second capped question", regenerate: false },
        {
          config: capped,
          providerFactory: () => mockProvider([textResponse("Answer.")]),
          now: () => NOW,
        },
      ),
    ).rejects.toMatchObject({ code: "usage_limit" });
  });

  it("scopes feedback, deletion, and history clearing to the owner", async () => {
    const first = await handleAdvisorChat(
      studentId,
      { message: "First conversation", regenerate: false },
      {
        config: config(),
        providerFactory: () => mockProvider([textResponse("Answer one.")]),
        now: () => NOW,
      },
    );
    const second = await handleAdvisorChat(
      studentId,
      { message: "Second conversation", regenerate: false },
      {
        config: config(),
        providerFactory: () => mockProvider([textResponse("Answer two.")]),
        now: () => NOW,
      },
    );

    expect(
      await setAdvisorMessageFeedback(
        otherStudentId,
        first.message.id,
        "HELPFUL",
      ),
    ).toBe(false);
    expect(
      await setAdvisorMessageFeedback(studentId, first.message.id, "HELPFUL"),
    ).toBe(true);
    const feedbackMessage = await db.advisorMessage.findUniqueOrThrow({
      where: { id: first.message.id },
    });
    expect(feedbackMessage.feedback).toBe("HELPFUL");

    expect(
      await deleteAdvisorConversation(otherStudentId, first.conversationId),
    ).toBe(false);
    expect(
      await deleteAdvisorConversation(studentId, first.conversationId),
    ).toBe(true);
    expect(
      await getAdvisorConversation(studentId, first.conversationId),
    ).toBeNull();

    expect(await clearAdvisorHistory(studentId)).toBe(1);
    expect(await listAdvisorConversations(studentId)).toEqual([]);
    expect(await listAdvisorConversations(otherStudentId)).toEqual([]);
    expect(
      await getAdvisorConversation(studentId, second.conversationId),
    ).toBeNull();
  });
});
