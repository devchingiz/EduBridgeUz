"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  History,
  Loader2,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";

import {
  clearAdvisorHistoryAction,
  deleteAdvisorConversationAction,
  setAdvisorFeedbackAction,
} from "@/app/dashboard/advisor/actions";
import { AdvisorHistory } from "@/components/advisor/advisor-history";
import { AdvisorMarkdown } from "@/components/advisor/advisor-markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { isSafeHref } from "@/lib/advisor/links";
import type {
  AdvisorConversationDTO,
  AdvisorErrorResponse,
  AdvisorFeedbackValue,
  AdvisorMessageDTO,
  AdvisorStatusDTO,
} from "@/lib/advisor/types";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "What should I do next?",
  "Which deadlines are closest?",
  "What documents am I missing?",
  "Find programs that fit my budget.",
];

const LOADING_STAGES = [
  "Reviewing your profile…",
  "Checking your workspace…",
  "Preparing a grounded answer…",
];

type InitialConversation = {
  conversation: AdvisorConversationDTO;
  messages: AdvisorMessageDTO[];
} | null;

type RetryPayload = { message: string; regenerate: boolean } | null;

function upsertConversation(
  list: AdvisorConversationDTO[],
  updated: AdvisorConversationDTO,
): AdvisorConversationDTO[] {
  return [updated, ...list.filter((item) => item.id !== updated.id)]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 50);
}

function findLastUserIndex(messages: AdvisorMessageDTO[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "USER") return index;
  }
  return -1;
}

export function AdvisorClient({
  initialConversations,
  initialConversation,
  status,
  maxInputChars,
  workspaceUnlocked,
}: {
  initialConversations: AdvisorConversationDTO[];
  initialConversation: InitialConversation;
  status: AdvisorStatusDTO;
  maxInputChars: number;
  workspaceUnlocked: boolean;
}) {
  const router = useRouter();
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [activeId, setActiveId] = useState<string | null>(
    initialConversation?.conversation.id ?? null,
  );
  const [messages, setMessages] = useState<AdvisorMessageDTO[]>(
    initialConversation?.messages ?? [],
  );
  const [conversations, setConversations] = useState(initialConversations);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState<RetryPayload>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null,
  );
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, sending]);

  useEffect(() => {
    if (!sending) return;
    const timer = window.setInterval(() => {
      setStageIndex((current) =>
        Math.min(current + 1, LOADING_STAGES.length - 1),
      );
    }, 900);
    return () => window.clearInterval(timer);
  }, [sending]);

  const activeConversation = conversations.find((item) => item.id === activeId);
  const canUse = workspaceUnlocked && status.enabled;
  const canSend = canUse && !sending && !actionBusy;

  function setConversationUrl(id: string | null) {
    const url = id
      ? `/dashboard/advisor?c=${encodeURIComponent(id)}`
      : "/dashboard/advisor";
    window.history.replaceState(null, "", url);
  }

  function startNew() {
    if (actionBusy) return;
    router.push("/dashboard/advisor");
    setActiveId(null);
    setMessages([]);
    setDraft("");
    setError(null);
    setRetry(null);
    setConfirmingDeleteId(null);
    setConfirmingClear(false);
    setSheetOpen(false);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  function selectConversation(id: string) {
    if (actionBusy || id === activeId) {
      setSheetOpen(false);
      return;
    }
    setError(null);
    setRetry(null);
    setSheetOpen(false);
    router.push(`/dashboard/advisor?c=${encodeURIComponent(id)}`);
  }

  async function submitMessage(rawText: string, regenerate = false) {
    const text = rawText.trim();
    if (!text || !canSend) return;
    if (regenerate && (!activeId || findLastUserIndex(messages) < 0)) return;

    const now = new Date().toISOString();
    let optimisticId: string | null = null;
    let requestMessage = text;
    let lastUserIndex = -1;
    let targetId = activeId;

    if (regenerate && activeId) {
      lastUserIndex = findLastUserIndex(messages);
      const lastUser = messages[lastUserIndex];
      if (!lastUser) return;
      requestMessage = lastUser.content;
      setMessages((current) => current.slice(0, lastUserIndex + 1));
    } else {
      optimisticId = `local-${Date.now()}`;
      setMessages((current) => [
        ...current,
        {
          id: optimisticId as string,
          role: "USER",
          content: text,
          model: null,
          citations: [],
          feedback: null,
          createdAt: now,
        },
      ]);
      setDraft("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    }

    setStageIndex(0);
    setSending(true);
    setError(null);
    setRetry(null);

    try {
      const response = await fetch("/api/advisor/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(targetId ? { conversationId: targetId } : {}),
          message: requestMessage,
          regenerate,
        }),
      });

      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const apiError =
          (payload as AdvisorErrorResponse | null)?.error ?? undefined;
        const serverConversationId = apiError?.conversationId;
        if (serverConversationId) {
          targetId = serverConversationId;
          setActiveId(serverConversationId);
          setConversationUrl(serverConversationId);
          setConversations((current) =>
            upsertConversation(current, {
              id: serverConversationId,
              title:
                current.find((item) => item.id === serverConversationId)
                  ?.title ?? text.slice(0, 60),
              createdAt:
                current.find((item) => item.id === serverConversationId)
                  ?.createdAt ?? now,
              updatedAt: now,
              messageCount:
                (current.find((item) => item.id === serverConversationId)
                  ?.messageCount ?? 0) + 1,
            }),
          );
        } else if (optimisticId) {
          setMessages((current) =>
            current.filter((message) => message.id !== optimisticId),
          );
        }

        setError(
          apiError?.message ??
            "The advisor could not answer right now. Please try again.",
        );
        setRetry({
          message: requestMessage,
          regenerate: Boolean(serverConversationId) || regenerate,
        });
        return;
      }

      const result = payload as {
        conversationId: string;
        title: string;
        message: AdvisorMessageDTO;
      };
      setMessages((current) => [...current, result.message]);
      setActiveId(result.conversationId);
      setConversationUrl(result.conversationId);
      setConversations((current) => {
        const existing = current.find(
          (item) => item.id === result.conversationId,
        );
        return upsertConversation(current, {
          id: result.conversationId,
          title: result.title,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          messageCount: (existing?.messageCount ?? 0) + (regenerate ? 1 : 2),
        });
      });
    } catch {
      if (optimisticId) {
        setMessages((current) =>
          current.filter((message) => message.id !== optimisticId),
        );
      }
      setError(
        "The advisor could not be reached. Check your connection and try again.",
      );
      setRetry({ message: requestMessage, regenerate });
    } finally {
      setSending(false);
    }
  }

  async function runAction(
    action: () => Promise<{ status: string; message?: string }>,
    onSuccess: () => void,
  ) {
    setActionBusy(true);
    setError(null);
    try {
      const result = await action();
      if (result.status === "error") {
        setError(result.message ?? "That action could not be completed.");
      } else {
        onSuccess();
      }
    } catch {
      setError("That action could not be completed. Please try again.");
    } finally {
      setActionBusy(false);
    }
  }

  function handleDelete(id: string) {
    void runAction(
      () => deleteAdvisorConversationAction(id),
      () => {
        setConversations((current) => current.filter((item) => item.id !== id));
        setConfirmingDeleteId(null);
        if (id === activeId) {
          startNew();
        }
      },
    );
  }

  function handleClear() {
    void runAction(
      () => clearAdvisorHistoryAction(),
      () => {
        setConversations([]);
        setConfirmingClear(false);
        setConfirmingDeleteId(null);
        startNew();
      },
    );
  }

  async function handleFeedback(
    messageId: string,
    feedback: AdvisorFeedbackValue,
  ) {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      const result = await setAdvisorFeedbackAction(messageId, feedback);
      if (result.status === "error") {
        setError(result.message ?? "Thanks, but that feedback was not saved.");
        return;
      }
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId ? { ...message, feedback } : message,
        ),
      );
    } catch {
      setError("Thanks, but that feedback was not saved.");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleCopy(message: AdvisorMessageDTO) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId(null), 1_500);
    } catch {
      setError("Copy is not available in this browser.");
    }
  }

  const history = (
    <AdvisorHistory
      conversations={conversations}
      activeId={activeId}
      onSelect={selectConversation}
      onNew={startNew}
      onDelete={handleDelete}
      onClear={handleClear}
      confirmingDeleteId={confirmingDeleteId}
      onConfirmDelete={setConfirmingDeleteId}
      confirmingClear={confirmingClear}
      onConfirmClear={setConfirmingClear}
      busy={actionBusy}
    />
  );

  return (
    <div className="border-border bg-background flex h-[calc(100dvh-9.5rem)] min-h-[34rem] overflow-hidden rounded-xl border shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
      <aside className="border-border bg-muted/20 hidden w-64 shrink-0 border-r p-4 lg:block">
        {history}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border flex items-center gap-3 border-b px-3 py-2.5 sm:px-4">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                className="lg:hidden"
                aria-label="Open advisor history"
              >
                <History aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent
              className="p-4"
              aria-describedby="advisor-history-description"
            >
              <SheetTitle>Advisor history</SheetTitle>
              <SheetDescription
                id="advisor-history-description"
                className="mb-4"
              >
                Your private conversations on this account.
              </SheetDescription>
              <div className="min-h-0 flex-1">{history}</div>
            </SheetContent>
          </Sheet>

          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold">
              {activeConversation?.title ?? "New conversation"}
            </h2>
            <p className="text-muted-foreground truncate text-[11px]">
              AI-generated guidance · verify with official sources
            </p>
          </div>

          <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">
            <Sparkles aria-hidden="true" className="size-3" />
            {status.enabled && status.model ? status.model : "Not configured"}
          </Badge>
        </header>

        {error ? (
          <div className="border-b border-amber-500/30 bg-amber-500/10 px-3 py-2 sm:px-4">
            <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
              <AlertCircle
                aria-hidden="true"
                className="size-4 shrink-0 text-amber-600 dark:text-amber-400"
              />
              <span className="min-w-0 flex-1">{error}</span>
              {retry ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canSend}
                  onClick={() => {
                    const payload = retry;
                    setRetry(null);
                    void submitMessage(payload.message, payload.regenerate);
                  }}
                >
                  <RotateCcw aria-hidden="true" />
                  Retry
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
          {messages.length === 0 ? (
            <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center px-2 text-center">
              <div className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-full">
                <Sparkles aria-hidden="true" className="size-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold tracking-[-0.02em]">
                Your study plan, grounded in your data
              </h3>
              <p className="text-muted-foreground mt-1.5 max-w-md text-[13px] leading-5">
                Ask about deadlines, documents, applications, or verified
                programs. Answers are AI-generated and always label their
                sources.
              </p>
              <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    disabled={!canSend}
                    onClick={() => void submitMessage(suggestion)}
                    className="border-border bg-card hover:bg-muted rounded-lg border px-3 py-2.5 text-left text-[12.5px] font-medium transition-colors disabled:opacity-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto flex max-w-4xl flex-col gap-5">
              {messages.map((message, index) => {
                const isUser = message.role === "USER";
                const lastAssistant =
                  message.role === "ASSISTANT" && index === messages.length - 1;
                return (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-2.5",
                      isUser ? "justify-end" : "justify-start",
                    )}
                  >
                    {!isUser ? (
                      <div className="bg-primary/10 text-primary mt-1 flex size-7 shrink-0 items-center justify-center rounded-full">
                        <Sparkles aria-hidden="true" className="size-3.5" />
                      </div>
                    ) : null}
                    <div
                      className={cn(
                        "max-w-[min(100%,44rem)] min-w-0 rounded-2xl border px-3.5 py-3 shadow-[0_1px_2px_rgb(15_23_42/0.04)]",
                        isUser
                          ? "bg-primary text-primary-foreground border-transparent"
                          : "bg-card border-border",
                      )}
                    >
                      <div
                        className={cn(
                          "mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px]",
                          isUser
                            ? "text-primary-foreground/70"
                            : "text-muted-foreground",
                        )}
                      >
                        {!isUser ? (
                          <span className="font-medium">
                            EduBridge AI Advisor
                          </span>
                        ) : null}
                        <time dateTime={message.createdAt}>
                          {formatDateTime(message.createdAt)}
                        </time>
                      </div>

                      {isUser ? (
                        <p className="text-[13.5px] leading-6 whitespace-pre-wrap">
                          {message.content}
                        </p>
                      ) : (
                        <>
                          <AdvisorMarkdown content={message.content} />

                          {message.citations.length > 0 ? (
                            <div className="border-border mt-3 flex flex-wrap gap-1.5 border-t pt-2.5">
                              {message.citations.map((citation) => (
                                <a
                                  key={citation.url}
                                  href={
                                    isSafeHref(citation.url)
                                      ? citation.url
                                      : undefined
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="bg-muted hover:bg-accent inline-flex max-w-full items-center gap-1 rounded-md px-2 py-1 text-[10.5px] font-medium"
                                >
                                  <span className="truncate">
                                    {citation.title}
                                  </span>
                                  {citation.verifiedAt ? (
                                    <span className="text-muted-foreground font-normal">
                                      · {citation.verifiedAt}
                                    </span>
                                  ) : null}
                                  <ExternalLink
                                    aria-hidden="true"
                                    className="size-3"
                                  />
                                </a>
                              ))}
                            </div>
                          ) : null}

                          <div className="border-border mt-3 flex flex-wrap items-center gap-1 border-t pt-2">
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              aria-label="Copy answer"
                              onClick={() => void handleCopy(message)}
                            >
                              {copiedId === message.id ? (
                                <Check
                                  aria-hidden="true"
                                  className="text-emerald-600"
                                />
                              ) : (
                                <Copy aria-hidden="true" />
                              )}
                            </Button>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant={
                                message.feedback === "HELPFUL"
                                  ? "secondary"
                                  : "ghost"
                              }
                              aria-label="Mark answer helpful"
                              disabled={actionBusy}
                              onClick={() =>
                                void handleFeedback(message.id, "HELPFUL")
                              }
                            >
                              <ThumbsUp aria-hidden="true" />
                            </Button>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant={
                                message.feedback === "UNHELPFUL"
                                  ? "secondary"
                                  : "ghost"
                              }
                              aria-label="Mark answer unhelpful"
                              disabled={actionBusy}
                              onClick={() =>
                                void handleFeedback(message.id, "UNHELPFUL")
                              }
                            >
                              <ThumbsDown aria-hidden="true" />
                            </Button>
                            {lastAssistant && activeId ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={!canSend}
                                onClick={() =>
                                  void submitMessage(message.content, true)
                                }
                              >
                                <RotateCcw aria-hidden="true" />
                                Regenerate
                              </Button>
                            ) : null}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {sending ? (
                <div className="flex items-center gap-2.5">
                  <div className="bg-primary/10 text-primary flex size-7 shrink-0 items-center justify-center rounded-full">
                    <Sparkles aria-hidden="true" className="size-3.5" />
                  </div>
                  <div className="bg-card border-border rounded-2xl border px-3.5 py-3">
                    <div className="flex items-center gap-2 text-[12.5px] font-medium">
                      <Loader2
                        aria-hidden="true"
                        className="size-3.5 animate-spin"
                      />
                      {LOADING_STAGES[stageIndex]}
                    </div>
                    <p className="text-muted-foreground mt-1 text-[10.5px]">
                      This can take a few seconds.
                    </p>
                  </div>
                </div>
              ) : null}
              <div ref={endRef} />
            </div>
          )}
        </div>

        <form
          className="border-border border-t px-3 py-3 sm:px-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submitMessage(draft);
          }}
        >
          <div className="bg-card border-border focus-within:ring-ring/30 rounded-xl border p-2 shadow-[0_1px_2px_rgb(15_23_42/0.04)] focus-within:ring-2">
            <textarea
              ref={textareaRef}
              value={draft}
              maxLength={maxInputChars}
              rows={1}
              placeholder={
                canUse ? "Ask about your study plan…" : "Advisor is unavailable"
              }
              disabled={!canSend}
              aria-label="Message the AI advisor"
              className="bg-transparent text-sm outline-none disabled:cursor-not-allowed"
              onChange={(event) => setDraft(event.target.value)}
              onInput={(event) => {
                const element = event.currentTarget;
                element.style.height = "auto";
                element.style.height = `${Math.min(element.scrollHeight, 144)}px`;
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submitMessage(draft);
                }
              }}
            />
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-[10.5px]">
                {draft.length}/{maxInputChars} · Enter to send, Shift+Enter for
                a new line
              </span>
              <Button
                type="submit"
                size="icon-sm"
                disabled={!canSend || !draft.trim()}
              >
                <Send aria-hidden="true" />
                <span className="sr-only">Send message</span>
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground mt-1.5 text-center text-[10.5px]">
            <Plus aria-hidden="true" className="mr-1 inline size-3" />
            The advisor cannot change your applications or upload documents. Use
            the workspace pages for those actions.
          </p>
        </form>
      </div>
    </div>
  );
}
