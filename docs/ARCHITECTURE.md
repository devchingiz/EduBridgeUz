# Architecture

## Current state

Milestone 1 delivers a statically rendered marketing application. Milestone 2 adds a persistent account system: PostgreSQL via Prisma, email/password authentication, sessions, password reset, student profiles, guardian consent for minors, a protected `/dashboard` shell, account settings, and RBAC.

Milestone 3 replaces the sample-only catalog with a PostgreSQL-backed, source-linked catalog: citations, universities, programs, scholarships, per-fact requirements, tuition, and deadlines, public search and filters, and a reviewer import/edit/decision workspace with an append-only review history.

Milestone 4 adds the student workspace: application tracking and stage history, a month calendar, private document management, preference-aware in-app notifications, and dashboard analytics. Milestone 5 stores documents in private S3-compatible buckets, scans quarantine uploads with ClamAV before promotion, and keeps downloads behind an authenticated owner-checked route. Backup and restore scripts are documented in the file operations runbook.

Milestone 6 adds standalone deployment configuration, production readiness checks, redacted structured logs, OpenTelemetry request spans, and CI gates. Milestone 8 adds a grounded AI Advisor with a private chat UI, owner-scoped persistence, read-only catalog/workspace tools, server-side provider adapters, source allowlisting, and cost controls. The 500-university catalog milestone adds QS 2027-backed discovery, field-level provenance, four-way comparison, private study notes, and an ADMIN-only university status management surface with audit logging. There is still no public JSON REST API. Real provider configuration, alert routing, scheduled backups, and managed-service recovery/load drills remain deployment requirements.

## High-level shape

```text
Browser
  └─ Next.js App Router (src/app)
       ├─ (marketing) route group
       │    ├─ server components: page composition, SEO, static content
       │    └─ client islands: search filtering, theme, nav menu, motion
       ├─ (auth) route group
       │    ├─ server pages: register, login, verify, reset, guardian consent
       │    ├─ client forms: useActionState wrappers
       │    └─ actions.ts: cookies, rate limits, redirects, audit
       ├─ dashboard route group
       │    ├─ server pages: session/workspace gates, app board, calendar, documents, notifications
       │    ├─ advisor/ server page + actions: private chat history and feedback mutations
       │    ├─ workspace-actions.ts: app/document/preferences mutations
       │    ├─ documents Route Handlers: same-origin private upload and owner-checked preview
       │    ├─ /api/advisor/chat: authenticated, same-origin JSON chat endpoint
       │    ├─ review/ server pages + actions: catalog import, edit, decisions
       │    └─ actions.ts: same-origin checks, validation, service calls
       ├─ UI system (src/components/ui)
       ├─ instrumentation.ts: OpenTelemetry registration and request-error reporting
       ├─ /api/health/live and /api/health/ready: liveness and readiness
       └─ Server-only domain layer (src/lib)
            ├─ advisor/*             provider adapters, tools, orchestration, sanitizing, persistence
             ├─ auth/service.ts       business use cases (no next/headers)
            ├─ auth/session.ts       session lifecycle and cookie helpers
            ├─ auth/tokens.ts        single-use hashed tokens
            ├─ auth/dal.ts           requireUser / requireRole / requireWorkspace
            ├─ catalog/queries.ts    public reads, review queue, data quality
            ├─ catalog/review-service.ts  reviewer writes and expiry sweep
            ├─ catalog/provenance.ts citation and per-fact response schemas
            ├─ workspace/service.ts owned application, document, and notification reads/writes
            ├─ workspace/storage.ts private S3 validation, quarantine, and access
            ├─ security/*            crypto, password policy, rate limiting
            ├─ email/*               transport and templates
            └─ db.ts                 Prisma singleton

Data
  └─ PostgreSQL 16+ (Prisma)
       ├─ production: managed PostgreSQL
       └─ local/test: PGlite over the PostgreSQL wire protocol

Production operations
  ├─ Docker standalone runtime; external PostgreSQL, S3, ClamAV, SMTP, OTLP collector
  ├─ private storage backups and isolated restore process (deployment)
  └─ provider alerts, domain/TLS, load and recovery verification (deployment gates)

Delivered milestone
  └─ 500-university QS 2027 catalog, comparison/notes, audited admin management,
     and DB-grounded advisor classification (500-university milestones 1–7)

Planned milestones
  ├─ Final verification and documentation (Milestone 9)
  └─ Handoff and external deployment/provider checks (Milestone 10)
```

## Rendering strategy

- **Server components by default.** Marketing pages, auth pages, dashboard pages, catalog pages, and legal pages render on the server. Marketing and legal pages are statically generated; auth, dashboard, and catalog pages are request-time rendered because they read cookies and the database.
- **Catalog pages are `dynamic = "force-dynamic"`.** The university and scholarship lists, detail pages, and sitemap query PostgreSQL at request time. This keeps `next build` independent of a live database and means a reviewer's decision is visible on the next request instead of after a redeploy.
- **Client islands only where interaction or a browser API is required:**
  - `UniversitySearch` — controlled filters over the demo marketing preview.
  - Catalog filters — GET forms with native `<select>` and `<input>`; no client state is needed, so filters work without JavaScript and are shareable as URLs.
  - `Navbar` / `Sheet` — scroll state and accessible mobile dialog.
  - `ThemeToggle` — next-themes.
  - `ProductPreview` — Recharts requires a client renderer.
  - `Reveal` — Framer Motion scroll reveal, disabled for reduced-motion users.
  - Auth, dashboard, and reviewer forms — `useActionState` for pending, error, and success states.
- **Metadata** is generated with the Next.js Metadata API. Private and staff routes set `robots: { index: false, follow: false }`; public catalog detail pages set `index, follow` with a canonical URL.
- **Server Actions** own cookie writes, rate limits, validation, and redirects. The security-relevant use cases live in `src/lib/auth/service.ts` and `src/lib/catalog/review-service.ts`, which deliberately avoid `next/headers` and `next/navigation` so they can be integration-tested without a request context.

## Route groups

| Route                                         | Purpose                                                       |
| --------------------------------------------- | ------------------------------------------------------------- |
| `(marketing)`                                 | Public marketing and trust pages sharing the navbar/footer    |
| `/`                                           | Landing page                                                  |
| `/privacy`, `/terms`, `/data-sources`         | Trust documents                                               |
| `(auth)`                                      | Shared auth shell; no session required to render              |
| `/register`, `/login`                         | Account creation and sign-in                                  |
| `/verify-email`                               | Render a confirmation screen; POST consumes the token         |
| `/forgot-password`, `/reset-password`         | Request and complete a password reset                         |
| `/guardian-consent/[token]`                   | Guardian review and decision page                             |
| `/guardian-consent/complete`                  | Decision receipt                                              |
| `/dashboard`                                  | Protected overview, workspace status, next steps              |
| `/dashboard/profile`                          | Study profile; minors need guardian consent                   |
| `/dashboard/guardian-consent`                 | Consent status and guardian contact/resend                    |
| `/dashboard/settings`                         | Password, active sessions, account deletion                   |
| `/dashboard/applications`                     | Nine-stage application Kanban board                           |
| `/dashboard/applications/[applicationId]`     | Status, deadline, notes, progress, history, linked documents  |
| `/dashboard/documents`                        | Private upload and document management                        |
| `/dashboard/documents/upload`                 | Same-origin, size/type/signature checked multipart upload     |
| `/dashboard/documents/[documentId]`           | Owner-checked private preview                                 |
| `/dashboard/calendar`                         | Month grid and upcoming student deadlines                     |
| `/dashboard/notifications`                    | In-app updates and notification preferences                   |
| `/dashboard/review`                           | Catalog review queue, all records, data quality (staff only)  |
| `/dashboard/review/new`                       | Import a university, program, or scholarship (staff only)     |
| `/dashboard/review/[entityType]/[id]`         | Review one record, edit fields, add facts, record a decision  |
| `/dashboard/admin`                            | Operations overview for `REVIEWER` and `ADMIN`                |
| `/dashboard/admin/users`                      | ADMIN-only role and session management                        |
| `/dashboard/admin/universities`               | ADMIN-only catalog search and audited status overrides        |
| `/dashboard/universities`                     | Dashboard discovery over the 500-university catalog           |
| `/dashboard/universities/[slug]`              | Catalog detail with provenance, comparison and note actions   |
| `/dashboard/comparison`                       | Four-way university comparison shortlist                      |
| `/dashboard/notes`, `/dashboard/notes/[id]`   | Private research notes with optional catalog links            |
| `/dashboard/advisor`                          | Private grounded AI chat with shortlist-estimate disclosure   |
| `/universities`                               | Public catalog with search and filters                        |
| `/universities/[slug]`                        | University profile and published programs                     |
| `/universities/[slug]/programs/[programSlug]` | Program profile with sourced facts and provenance             |
| `/scholarships`                               | Scholarship search with funding and nationality filters       |
| `/scholarships/[slug]`                        | Scholarship detail with sourced eligibility and deadlines     |
| `/robots.txt`, `/sitemap.xml`                 | Crawler metadata; the sitemap includes public catalog entries |

Marketing and catalog pages never import reviewer services or staff-only modules.

## Authentication architecture

### Layers

1. **Server Actions** (`src/app/(auth)/actions.ts`, `src/app/dashboard/actions.ts`) — the only place cookies are set or cleared. They check the request origin, apply rate limits, parse `FormData` with Zod, call the service layer, and redirect or return a serialisable `FormState`.
2. **Service layer** (`src/lib/auth/service.ts`) — registration, login, email verification, password reset, guardian decisions, profile updates, password changes, and account deletion. It owns transactions, token issuance, email dispatch, and audit events.
3. **Data Access Layer** (`src/lib/auth/dal.ts`) — `requireUser`, `requireRole`, and `requireWorkspace`. Pages and actions call these; a layout check is never treated as authorization.
4. **Session layer** (`src/lib/auth/session.ts`) — creates, validates, renews, lists, and revokes sessions. It is the only module that knows the cookie contract.
5. **Persistence** (`src/lib/db.ts`, Prisma) — a single client instance reused across hot reloads.

### Sessions

- Opaque 32-byte tokens generated with `crypto.randomBytes`, encoded as base64url.
- Only the SHA-256 hash is stored in `Session.tokenHash`. A database leak cannot be replayed.
- Cookie: `edubridge_session`, `httpOnly`, `SameSite=Lax`, `Secure` in production, `Path=/`, `Priority=high`, lifetime equal to the absolute session cap.
- Idle expiry is 7 days and slides forward while the user is active; renewal happens only when fewer than 6 days remain, and the idle window is capped by the 30-day absolute expiry.
- `lastUsedAt` is touched at most once per hour to avoid a write on every request.
- Sessions are revoked on logout, password change, password reset, account deletion, and explicit revocation from account settings.

### Tokens

`AuthToken` covers three purposes with different lifetimes:

| Purpose              | Lifetime   | Consumer                      |
| -------------------- | ---------- | ----------------------------- |
| `EMAIL_VERIFICATION` | 24 hours   | `POST /verify-email` action   |
| `PASSWORD_RESET`     | 30 minutes | `POST /reset-password` action |
| `GUARDIAN_CONSENT`   | 7 days     | Guardian decision action      |

Tokens are hashed at rest and consumed with a conditional `updateMany` (`usedAt IS NULL`), which makes redemption atomic and single-use. Issuing a new token marks older unused tokens for the same purpose as used. Links render a confirmation page and are consumed by a POST action, so email link scanners cannot redeem them.

### Rate limiting

`RateLimitCounter` is a database-backed fixed-window counter shared across server instances. A single atomic upsert increments the current window, so concurrent requests cannot bypass the limit. Keys are `scope:HMAC-SHA256(identifier)` using `AUTH_SECRET`, so raw emails and IP addresses are never stored. If the database is unavailable the limiter fails open, because the database is required for authentication anyway; the alternative would turn a transient outage into a total lockout.

Limits are defined in `src/lib/auth/rate-limits.ts` and documented in [SECURITY.md](SECURITY.md).

### Email

- `console` transport writes JSON messages to `.data/mail/` for development.
- `smtp` transport is required in production; `EMAIL_TRANSPORT=console` throws at request time in production.
- Email delivery failures are logged but do not roll back a correctly created account or password change. The user can request another link.

### Minors and workspace gating

`getWorkspaceStatus` derives a single status object from the user and profile:

- `emailVerified` — the account confirmed its address.
- `isMinor` — date of birth is under 18 at request time.
- `guardianConsentRequired` — minor without a recorded `guardianConsentAt`.
- `canUseWorkspace` — an active session and, for minors, recorded guardian consent. Email verification is optional.

`requireWorkspace` redirects unverified users to `/verify-email?pending=1` and unconsented minors to `/dashboard/guardian-consent`. Account settings stay reachable so a locked-out student can still change their password or delete their account.

### RBAC

- Roles: `STUDENT`, `REVIEWER`, `ADMIN`, stored server-side.
- `requireRole([...])` redirects unauthorised users to `/dashboard`.
- `/dashboard/review` and every catalog mutation require `REVIEWER` or `ADMIN`. The check runs in the page **and** in each Server Action; hiding a link is never the boundary.
- `/dashboard/admin` exposes aggregate counts plus recent audit events; it never shows student profile content. `/dashboard/admin/users` and `/dashboard/admin/universities` require `ADMIN`, re-check the role in each action, and write append-only audit events.
- Reviewer pages are `noindex, nofollow`, and catalog writes are not reachable from any public route.
- Roles are never accepted from the client or inferred from a form field.

## Catalog architecture

### Read path

`src/lib/catalog/queries.ts` is the only public reader:

1. List queries filter `verificationStatus` to the public-visible set (`VERIFIED`, `PARTIALLY_VERIFIED`, `NEEDS_REVIEW`), so unverified, information-unavailable, expired, and archived records never appear publicly.
2. Text search uses case-insensitive `contains` over the record's name, city, and provider; filters map directly to indexed columns (`countryCode`, `degreeLevel`, `field`, `hostCountryCode`, `fundingType`).
3. Detail queries load the record with its primary citation, facts, and child programs, then build a response object and validate it with a Zod schema from `src/lib/catalog/provenance.ts`.
4. If validation fails, the query logs the slug and issues and returns `null`; the page renders a not-found state rather than publishing an unvalidated fact.

The response schema is the contract between the database and the UI. It requires every fact to carry `{ status, source: { url, publisher, title, verifiedAt } }`, so a fact cannot be rendered without its provenance.

### Reviewer write path

`src/lib/catalog/review-service.ts` owns all catalog mutations:

- **Import** creates the citation and the record in one transaction. A record enters as `VERIFIED` only when the citation has a `verifiedAt` date; otherwise it enters as `UNVERIFIED` and waits in the queue.
- **Edit** updates fields and returns the record to `NEEDS_REVIEW` unless the reviewer explicitly marks it verified.
- **Facts** are added against the record's primary source. The service rejects a fact that would belong to neither a program nor a scholarship.
- **Decisions** (`APPROVE`, `REQUEST_CHANGES`, `RESTORE`, `EXPIRE`, `ARCHIVE`, `MARK_PARTIAL`, `MARK_UNAVAILABLE`, `FLAG_STALE`) validate the current status, write a `CatalogReview` row and an `AuditEvent`, and set `lastVerifiedAt`/`nextReviewAt` where applicable. `APPROVE` requires a citation with `verifiedAt` and schedules the next review 180 days out. `MARK_PARTIAL` and `MARK_UNAVAILABLE` explicitly move a record to `PARTIALLY_VERIFIED` and `INFORMATION_UNAVAILABLE`.
- **Expiry sweep** (`npm run catalog:expire`) selects `VERIFIED` records whose `nextReviewAt` has passed and moves them to `NEEDS_REVIEW` with a review row and audit event. It never deletes and never auto-approves.

All input passes through `src/lib/catalog/review-validation.ts` before Prisma is called. Every mutation re-checks the staff role and same-origin request in the Server Action.

### Provenance rules

- A verified fact always has a source URL and a human verification date.
- A missing tuition amount, deadline, or requirement is rendered as an explicit unknown state, never estimated.
- `NEEDS_REVIEW` and `PARTIALLY_VERIFIED` records stay public with a warning banner; `INFORMATION_UNAVAILABLE`, `UNVERIFIED`, `EXPIRED`, and `ARCHIVED` are hidden.
- Reviewer history is append-only and survives staff account deletion (`reviewerId` becomes `NULL`).
- Full rules and the seed coverage are in [DATA-QUALITY.md](DATA-QUALITY.md).

## Component layers

1. **Primitives** (`components/ui`) — Button, Badge, Card, Input, Select, Checkbox, Alert, Accordion, Sheet. They contain styling and accessibility only.
2. **Brand and layout** — logo, navbar, footer, theme toggle. Navigation is data-driven from `lib/site.ts`.
3. **Auth components** (`components/auth`) — form field, password input, submit button, form message, resend verification.
4. **Dashboard components** (`components/dashboard`) — shell, navigation, gate banner.
5. **Advisor components** (`components/advisor`) — chat view, history sheet, Markdown-only renderer with shared link allowlist.
6. **Catalog components** (`components/catalog`) — verification badge, source card, citation line, filter panel, empty state. Every rendered fact passes through one of these so a value and its source are never separated.
7. **Review components** (`components/review`) — import form, record edit form, decision buttons, fact add/remove forms.
8. **Marketing sections** — one component per section. Content is local and explicit; no business logic.
9. **Domain helpers** — pure functions such as `filterSampleUniversities`, `evaluateAgeGate`, `checkPassword`, catalog filter parsers, and provenance formatting, testable without React or a database.

Business logic lives in `src/lib`, not in components. UI components never query Prisma directly.

## Design system

- Tailwind CSS 4 with CSS variables exposed through `@theme inline` in `src/app/globals.css`.
- Semantic tokens (`background`, `foreground`, `card`, `muted`, `primary`, `border`, `ring`, chart colors) support light and dark themes.
- Default theme is light; a class-based dark theme is persisted by `next-themes`. `color-scheme` is set so native controls follow the theme.
- Typography uses Geist Sans and Geist Mono from the local `geist` package, avoiding a network dependency during builds.
- Accent: indigo with a restrained sky highlight. Backgrounds stay neutral; gradients appear only as low-opacity atmospheric layers.
- Spacing is consistent through `.site-container`, `.section-shell`, and responsive section padding.
- Motion is limited to a slow fade/translate on section entry, hover color/shadow transitions, and the accordion; `prefers-reduced-motion` disables it.

## Data integrity architecture

The public catalog is the product's trust surface, so it is built around provenance rather than convenience:

- `SourceCitation` stores the official URL, publisher, page title, access date, and human verification date. `url` is unique; re-importing the same page updates one citation.
- `University`, `Program`, and `Scholarship` require a `primarySourceId`. Tuition, deadlines, and requirements live in `Requirement`, `TuitionFact`, and `DeadlineFact`, each with its own source and status.
- Public reads only return `VERIFIED`, `PARTIALLY_VERIFIED`, and `NEEDS_REVIEW` records. The latter two render a warning banner explaining that the record is a lead, not a current official fact.
- The response contract in `src/lib/catalog/provenance.ts` validates every fact plus its citation before rendering. A record that fails validation is withheld and logged instead of shown partially.
- Unknown values are explicit. `Program.startNote` keeps wording such as "Winter and summer semester" rather than inventing month numbers; `DeadlineFact.opensMonthDay` stores `MM-DD` when the provider publishes a recurring date without a year; a missing tuition amount renders as unknown.
- Eligibility scopes (`ALL`, `LISTED`, `UNKNOWN`) prevent an empty nationality list from being read as "everyone is eligible".
- Reviewer decisions are append-only (`CatalogReview` + `AuditEvent`), and the expiry sweep only demotes records to `NEEDS_REVIEW`.
- `src/lib/demo/sample-universities.ts` remains only for the marketing preview and is clearly labeled. It is not part of the catalog read path.
- The seed catalog in `src/lib/catalog/seed-data.ts` contains hand-checked records only. Its coverage and gaps are recorded in [DATA-QUALITY.md](DATA-QUALITY.md).

## Local and production database strategy

- **Production:** managed PostgreSQL 16+ with `prisma migrate deploy`.
- **Local development:** PGlite (`@electric-sql/pglite`) served over the PostgreSQL wire protocol by `scripts/dev-db.mjs`. It exercises real PostgreSQL SQL semantics without a system install.
- The local `DATABASE_URL` appends `&pgbouncer=true` to disable Prisma prepared statements. PGlite retains prepared statements across client reconnects, which otherwise collides with Prisma's `s0`-style statement names after a dev-server restart. Managed PostgreSQL does not need this parameter.
- **Integration tests:** a fresh PGlite process per run on a random free port and a separate `.data/pglite-test` directory. The harness waits for the server's stdout ready line instead of probing TCP, because a probe would consume a connection slot.

## Internationalization plan

The product targets English (default), Uzbek, and Russian. Milestones 1–3 ship English only. A locale-prefixed route strategy was considered but deferred until the catalog and workspace routes stabilize, to avoid rewriting every link twice.

Recommended approach: `next-intl` with locale segments (`/en`, `/uz`, `/ru`) or cookie-based locale negotiation, dictionaries stored outside components, and localized metadata. Currency formatting uses `Intl.NumberFormat`; no hardcoded currency strings in components.

## AI architecture

The advisor follows the same server-side domain pattern as the rest of the application. See [AI-ADVISOR.md](AI-ADVISOR.md) for the full contract.

- `POST /api/advisor/chat` checks origin, session, and workspace gate, then parses a strict Zod body. The browser supplies only conversation ID, message text, and a regenerate flag.
- `src/lib/advisor/chat.ts` orchestrates limits, conversation ownership, bounded history, provider calls, tool rounds, sanitizing, persistence, and usage accounting. Provider injection keeps tests deterministic.
- `src/lib/advisor/providers/` adapts OpenAI-compatible Chat Completions, Anthropic Messages, OpenRouter, and generic compatible endpoints behind one interface. Keys and base URLs are server-only environment values.
- `src/lib/advisor/tools.ts` exposes ten read-only tools. All execute with the session user ID and return data plus provenance; they cannot write or act on the student's behalf.
- `src/lib/advisor/sanitize.ts` strips dangerous HTML, allows only internal paths or real tool sources, and appends a server-generated source list with verification dates. The client rechecks every href with the shared allowlist and renders Markdown without raw HTML.
- `AdvisorConversation`, `AdvisorMessage`, and `AdvisorUsage` persist private history and metadata-only cost data. Deletion is hard-delete for content; only deletion/clear events are audited.
- Fixed-window database counters and a daily usage ledger enforce message and estimated-cost caps. Logs use an allowlist that excludes prompts, answers, document names, emails, keys, and IPs.

## Testing strategy

- **Unit:** pure helpers and advisor adapters/validation/sanitizing with Vitest. 184 tests currently pass across 27 files.
- **Integration:** auth, catalog, workspace, and advisor use cases against a throwaway PGlite database. The advisor suite covers persistence, ownership, tool scoping, source allowlisting, regeneration, provider failure, rate/cost caps, feedback, deletion, and clear history. 60 tests currently pass across 7 files.
- **E2E:** Playwright for registration, authorization boundaries, upload rejection, and AI failure states remains a later milestone; live provider verification also remains outstanding.
- Typecheck, ESLint, formatting, and production build are required gates for every milestone.

## Key decisions and rationale

| Decision                                             | Rationale                                                                                                                                                                   |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Manual scaffold instead of `create-next-app`         | Full control over design tokens, structure, and dependency versions; no interactive prompts in this environment.                                                            |
| Next.js 16 App Router + React 19                     | Current stable stack, server components reduce client JS.                                                                                                                   |
| Tailwind 4 + custom shadcn-style primitives          | Keeps the design system small and auditable; no unused component library bulk.                                                                                              |
| Custom opaque sessions instead of Auth.js            | Full control over token hashing, idle/absolute expiry, revocation, and integration testing; the Auth.js adapter shape would add a dependency without simplifying the flows. |
| PostgreSQL target with PGlite locally                | Same SQL semantics in development and tests without requiring Docker or a system PostgreSQL install.                                                                        |
| Argon2id via `@node-rs/argon2`                       | Maintained native binding with the OWASP baseline; parameters are stored in the hash so they can be raised later.                                                           |
| Database-backed fixed-window rate limits             | Works across server instances without Redis; a small boundary burst is acceptable for authentication throttling.                                                            |
| Tokens consumed by POST actions                      | Email scanners and link previews issue GET requests; requiring a button press prevents accidental redemption.                                                               |
| Service layer free of `next/headers`                 | Security-relevant flows can be integration-tested without a request context.                                                                                                |
| `proxy.ts` only checks cookie presence               | A fast redirect is a UX optimisation, not an authorization boundary; pages and actions re-check against the database.                                                       |
| Native `<select>` in the preview and profile         | Reliable keyboard/screen-reader behavior and zero extra JS.                                                                                                                 |
| Facts in separate tables, not record columns         | Each tuition, deadline, and requirement carries its own source and status, so one stale fact does not silently contaminate the record.                                      |
| `primarySourceId` required with `onDelete: Restrict` | A catalog record cannot exist without a citation, and a citation cannot vanish while a record still points at it.                                                           |
| Response schemas validate every fact + citation      | The UI cannot render a value without provenance; a malformed record is withheld and logged instead of shown partially.                                                      |
| `NEEDS_REVIEW` stays public with a banner            | A previously checked record is still a useful lead; hiding it loses information, while presenting it as verified would be dishonest.                                        |
| Expiry sweep demotes, never deletes                  | Re-review is a workflow state, not data loss; reviewers can restore or update the record later.                                                                             |
| Catalog pages force-dynamic                          | `next build` stays independent of a live database, and reviewer decisions appear on the next request.                                                                       |
| Eight sample universities, no tuition/rank/deadline  | Demonstrates the search UX without fabricating facts.                                                                                                                       |
| No fake testimonials or user counts                  | Trust is the product differentiator; placeholder content is explicitly labeled.                                                                                             |
