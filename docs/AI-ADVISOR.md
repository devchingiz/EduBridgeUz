# AI Advisor

> **Status: implemented for Milestone 8 with 500-university grounding.** The advisor is a server-side, grounded chat experience at `/dashboard/advisor`. Provider adapters and orchestration are covered by automated tests with injected doubles. A live provider key was not available in this environment, so live model quality, latency, billing, and provider retention settings remain deployment verification tasks.

> **Dashboard UI status:** `/dashboard/advisor` currently shows a coming-soon page while the advisor is being upgraded. The chat component, server actions, API route, provider adapters, tools, and tests are intentionally kept in place so the experience can be restored without rebuilding them.

## What ships

- A private chat page with multi-turn history, new/delete/clear conversations, titles, timestamps, feedback, copy, regenerate, staged loading, and safe retry/error states.
- A non-streaming `POST /api/advisor/chat` contract. v1 returns one validated JSON answer; the client shows staged progress while the request is in flight.
- Provider adapters for OpenAI-compatible Chat Completions (`openai`), Anthropic Messages (`anthropic`), OpenRouter (`openrouter`), and arbitrary OpenAI-compatible endpoints (`compatible`).
- Eleven read-only tools that query the signed-in student's own workspace and the source-linked 500-university catalog. The browser cannot call tools, choose a model, or supply credentials.
- Per-user conversation persistence, ownership checks, rate limits, cost caps, timeout handling, metadata-only usage accounting, and redacted operational logs.

## Provider configuration

All settings are server-side environment variables. See `.env.example` for the local template.

| Variable                      | Default                    | Purpose                                                                                          |
| ----------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------ |
| `AI_PROVIDER`                 | `openai`                   | `openai`, `anthropic`, `openrouter`, or `compatible`.                                            |
| `AI_API_KEY`                  | empty                      | Server-only credential; the advisor is disabled when this is missing.                            |
| `AI_MODEL`                    | `gpt-4.1-mini`             | Model ID sent to the provider. Must use only letters, digits, `.`, `_`, `:`, `/`, and `-`.       |
| `AI_BASE_URL`                 | provider default           | Optional override. Required for `compatible`; must be HTTPS outside localhost and in production. |
| `AI_TIMEOUT_MS`               | `30000`                    | Per-provider-call timeout, 1,000–120,000 ms.                                                     |
| `AI_MAX_OUTPUT_TOKENS`        | `1200`                     | Response cap, 128–4,096 tokens.                                                                  |
| `AI_MAX_CONTEXT_MESSAGES`     | `16`                       | Number of prior turns sent as history, 2–40.                                                     |
| `AI_MAX_INPUT_CHARS`          | `4000`                     | Per-message character cap, 200–12,000.                                                           |
| `AI_MAX_TOOL_ROUNDS`          | `4`                        | Maximum tool loops per answer, 1–8.                                                              |
| `AI_MAX_TOOLS_PER_ROUND`      | `5`                        | Maximum executed calls per tool round, 1–10.                                                     |
| `AI_MESSAGES_PER_MINUTE`      | `8`                        | Per-user message throttle, 1–60.                                                                 |
| `AI_DAILY_USER_MESSAGES`      | `40`                       | Per-user daily message cap, 1–500.                                                               |
| `AI_DAILY_USER_COST_USD`      | `2`                        | Per-user estimated daily cost cap.                                                               |
| `AI_DAILY_GLOBAL_COST_USD`    | `25`                       | Global estimated daily cost cap.                                                                 |
| `AI_PRICE_INPUT_PER_MILLION`  | built-in table or fallback | Optional USD per million input tokens.                                                           |
| `AI_PRICE_OUTPUT_PER_MILLION` | built-in table or fallback | Optional USD per million output tokens.                                                          |

Known model rates are configured in `src/lib/advisor/config.ts`. An unfamiliar model uses a conservative fallback rather than a zero-cost assumption. Production readiness checks require `AI_PROVIDER`, `AI_API_KEY`, and `AI_MODEL`; the status shown in the dashboard never includes the key or base URL.

## HTTP contract

### `POST /api/advisor/chat`

Requires a same-origin request, a valid session, and an unlocked workspace. The request body is JSON and is limited to 32,000 characters before parsing.

```ts
type AdvisorChatRequest = {
  conversationId?: string; // 1-64 chars: A-Z, a-z, 0-9, _, -
  message: string; // trimmed, <= AI_MAX_INPUT_CHARS, no control characters
  regenerate?: boolean; // default false
};
```

A successful response is `Cache-Control: no-store` JSON:

```ts
type AdvisorChatResponse = {
  conversationId: string;
  title: string;
  message: {
    id: string;
    role: "ASSISTANT";
    content: string;
    model: string | null;
    citations: Array<{ url: string; title: string; verifiedAt: string | null }>;
    feedback: "HELPFUL" | "UNHELPFUL" | null;
    createdAt: string;
  };
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostMicros: number;
  };
};
```

| Code                        | HTTP | Meaning                                                              |
| --------------------------- | ---- | -------------------------------------------------------------------- |
| `unauthorized`              | 401  | No valid session.                                                    |
| `unauthorized`              | 403  | Cross-origin request rejected.                                       |
| `blocked`                   | 403  | Workspace is locked, usually pending guardian consent.               |
| `invalid_request`           | 400  | Malformed, oversized, or invalid JSON body.                          |
| `not_found`                 | 404  | Conversation does not belong to the signed-in student.               |
| `rate_limited`              | 429  | Per-minute or fixed-window cap reached; includes `Retry-After`.      |
| `usage_limit`               | 429  | Daily message or estimated-cost cap reached; includes `Retry-After`. |
| `ai_not_configured`         | 503  | Missing or invalid server configuration.                             |
| `provider_auth`             | 503  | Provider rejected server credentials.                                |
| `provider_rate_limit`       | 503  | Provider throttled the server; provider `Retry-After` is forwarded.  |
| `provider_unavailable`      | 503  | Provider or network failure, including unexpected errors.            |
| `provider_timeout`          | 503  | Provider call timed out.                                             |
| `provider_invalid_response` | 503  | Provider response could not be mapped to a usable answer.            |

Errors use the same safe shape and may include `error.conversationId` so the client can keep the persisted student message after a provider failure instead of duplicating it on retry. Raw provider bodies, keys, prompts, and student content are never returned.

### Server Actions

History mutations live in `src/app/dashboard/advisor/actions.ts`. Each action re-checks same-origin, session, and workspace access, then scopes the database call to the session user.

| Action                            | Effect                                                          |
| --------------------------------- | --------------------------------------------------------------- |
| `deleteAdvisorConversationAction` | Hard-deletes one owned conversation and its messages.           |
| `clearAdvisorHistoryAction`       | Hard-deletes all owned conversations and messages.              |
| `setAdvisorMessageFeedbackAction` | Stores `HELPFUL` or `UNHELPFUL` on one owned assistant message. |

Deletion and clear-history events write redacted `AuditEvent` rows. Feedback does not create audit noise.

## Orchestration

1. The route rejects cross-origin and unauthenticated requests, checks the workspace gate, and parses the request with a strict Zod schema.
2. `handleAdvisorChat` loads validated server config, enforces rate and cost limits, and resolves the target conversation with owner-scoped reads. Regeneration removes only the previous assistant turn and reuses the stored student message.
3. A minimized student-context block is generated from the signed-in user's profile, applications, documents, deadlines, favorites, and analytics. It is injected as clearly labeled data, not instructions.
4. The provider receives the static system prompt, the context block, bounded wrapped history, the current student message, and read-only tool schemas. Each call has a timeout and a bounded overall signal.
5. Tool calls are Zod-validated, limited per round, and executed with the session user ID. Results are truncated, wrapped as untrusted data, and returned to the model.
6. After at most four tool rounds, a final call without tools produces the answer. If no safe answer is produced, the provider error path records the failure and returns a safe message.
7. The server sanitizes the answer, appends verified sources, persists the assistant message, records metadata-only usage, logs allowlisted metrics, and returns the DTO.

## Read-only tools

| Tool                        | Data source                                                                                                                                  |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_student_overview`      | Minimized profile, counts, and nearest owned deadline.                                                                                       |
| `list_applications`         | The student's applications, status, progress, notes, and linked documents.                                                                   |
| `get_upcoming_deadlines`    | Owned deadlines within a bounded day window.                                                                                                 |
| `list_documents`            | Owned document metadata; never file contents.                                                                                                |
| `get_incomplete_tasks`      | Deterministic tasks derived from real owned records.                                                                                         |
| `search_universities`       | Public-visible, source-linked university/program catalog.                                                                                    |
| `get_university_details`    | Source-linked details for one catalog university.                                                                                            |
| `get_saved_items`           | The student's saved universities and scholarships.                                                                                           |
| `summarize_recent_activity` | Owned status changes, notifications, and document updates.                                                                                   |
| `get_recommendations`       | Deterministic next steps derived from real profile/workspace/catalog data.                                                                   |
| `classify_shortlist`        | QS 2027 rank bands plus catalog tuition/degree/field facts and the saved budget, returned as planning estimates with a mandatory disclosure. |

There are no write, email, upload, submission, payment, or administrative tools. Every tool is called with the authenticated user ID supplied by the route; model-provided arguments cannot choose another user.

## Grounding and output safety

- The static system prompt forbids invented catalog facts, admission or funding guarantees, and unsupported URLs. Student data is separated from instructions and tool output is explicitly marked untrusted.
- Reach / Target / Likely must come from `classify_shortlist`, which uses only QS 2027 rank bands, catalog tuition/degree/field facts, and the student's saved budget. The tool returns an explicit disclosure that these are planning estimates, not admission predictions or guarantees, and the advisor page repeats it to every student. Exact QS rank strings, including ties and ranges, are preserved in the explanation.
- `finalizeAssistantContent` strips dangerous HTML, allows only known internal paths and source URLs returned by tools, converts unverified external Markdown links to plain text, and replaces unverified bare URLs.
- Citations are server-generated from real tool sources, deduplicated by normalized URL, capped at six, and include human verification dates when present. A server-generated source block makes provenance visible even if the model omits it.
- The client renders Markdown without raw HTML and rechecks every href against the same shared allowlist. External links open with `noopener noreferrer`.

## Cost and observability

Per-minute messages, daily messages, estimated per-user cost, and estimated global cost are enforced with atomic database counters plus a daily metadata ledger. A conservative worst-case estimate is used at admission time; actual token counts are recorded after the response. Logs include allowlisted fields only: provider, model, outcome, latency, tool count, token counts, and estimated micro-USD cost. They never include message content, prompts, document names, emails, keys, or IPs.

## Data model

Migration `20261117000200_advisor` adds:

- `AdvisorConversation`: owner, title, timestamps, messages, usage.
- `AdvisorMessage`: role, content, model, validated citations JSON, tool names, feedback, timestamp.
- `AdvisorUsage`: owner, optional conversation, provider/model, token counts, estimated cost, outcome, timestamp.
- Enums `AdvisorMessageRole`, `AdvisorFeedback`, and `AdvisorRequestOutcome`.

Conversations and messages cascade on account deletion and are hard-deleted by the advisor actions. `AdvisorUsage.conversationId` becomes `NULL` when a conversation is deleted so aggregate cost history remains available without retaining message content.

## Verification and limitations

Automated verification covers provider adapters, request validation, sanitizing, tools, route guards, allowlisted logging, persistence, per-user isolation, tool scoping, source allowlisting, regeneration, provider failure, rate/cost caps, feedback, deletion, and clear history. The 500-university milestone adds unit coverage for rank-band classification and integration coverage that `classify_shortlist` reads only visible catalog rows and returns real source URLs. The migration was applied to a fresh integration database and the local development database.

Browser QA was performed against the running development UI at a 429 CSS-pixel-wide viewport with a temporary authenticated student account and seeded conversations. It confirmed the setup-required state, disabled composer/send/regenerate controls, visible timestamps and titles, the history sheet with two conversations, a safe citation link with `noopener noreferrer`, persisted helpful feedback, the clipboard-unavailable fallback message, single-conversation deletion, clear-all history, dark-mode persistence across reload, and no document-level horizontal overflow. `POST /api/advisor/chat` returned `503 ai_not_configured` with `Cache-Control: no-store` and no provider details. Temporary QA data was deleted afterward.

Remaining boundaries:

- No real `AI_API_KEY` was available, so no live provider response, real billing figure, or provider retention policy was verified.
- v1 does not stream tokens; it returns one JSON answer after completion.
- Cost figures are estimates from the configured pricing table and can drift from provider invoices.
- Playwright end-to-end tests are not part of this milestone; browser QA was performed against the running development UI.
- Provider-specific aggressive rate limits, outage behavior, and retention/zero-retention settings must be confirmed in the target environment.
