# EduBridge

**Your Bridge to Global Education.**

EduBridge is an international university discovery, scholarship search, and student application management platform. It is being built for students in Uzbekistan, Central Asia, and around the world — starting with a reliable, source-linked foundation rather than a demo full of invented data.

> **Status: 500-university QS 2027 catalog implemented; live provider verification and external production checks remain.** EduBridge includes the marketing site, secure accounts, source-linked university and scholarship discovery, a protected student workspace, private S3-compatible file storage with ClamAV scanning and backup/restore tooling, health checks, structured telemetry, CI/container configuration, four-way comparison, private research notes, audited ADMIN catalog management, and a grounded AI Advisor with DB-backed shortlist estimates. Provider adapters and orchestration are covered by automated tests with injected doubles; a real `AI_API_KEY` was not available locally, so a live model response remains a deployment verification step. See [docs/500-UNIVERSITIES-PROGRESS.md](docs/500-UNIVERSITIES-PROGRESS.md), [docs/AI-ADVISOR.md](docs/AI-ADVISOR.md), [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md), [docs/ROADMAP.md](docs/ROADMAP.md), and [docs/SECURITY.md](docs/SECURITY.md).

---

## What is implemented

### Milestone 3 — source-linked catalog

- **Catalog schema:** `SourceCitation`, `University`, `Program`, `Scholarship`, `Requirement`, `TuitionFact`, `DeadlineFact`, `CatalogReview`, and per-user university/scholarship favorites with committed migrations. Tuition, deadlines, and requirements are separate fact rows, each pointing at a citation.
- **Public catalog:** `/universities` and `/scholarships` with PostgreSQL-backed search and filters for country, degree level, field, funding type, and nationality. `/universities/[slug]` and `/universities/[slug]/programs/[programSlug]` show every fact with its source, publisher, and verification date.
- **Student favorites:** signed-in students can save universities and scholarships from search results or detail pages and manage them at `/dashboard/favorites`. Favorites are private to the account; archived entries remain visible there so they can be removed.
- **Dashboard discovery:** `/dashboard/universities` reuses the same verified catalog with name search, country, degree, annual tuition/currency, linked scholarship, intake, sort, and 12-item pagination filters. `/dashboard/universities/[slug]` presents cited costs, linked catalog scholarships, requirements, intakes, and deadlines, with favorite, tracker, and supported calendar actions. Filters are Zod-validated URL parameters and both routes require the student workspace guard.
- **Structured discovery facts:** `ProgramCost`, `ProgramIntake`, and `ProgramScholarship` preserve sourced living/application costs, typed intake terms, and program-specific scholarship links. The migration is `20261117000100_university_discovery_details`; the seed adds only TUM's explicitly published winter/summer terms. No living costs, application fees, or university-specific scholarship links are invented where source-backed facts are absent.
- **Global catalog:** exactly 500 distinct universities sourced from the public QS 2027 indexes, with exact rank strings (including ties and ranges), 2,232 programmes, Wikidata official websites where confidently available, and field-level provenance. Four hand-verified seed universities remain `VERIFIED`. See [docs/500-UNIVERSITIES-PROGRESS.md](docs/500-UNIVERSITIES-PROGRESS.md).
- **Comparison and notes:** signed-in students can keep a private four-item university shortlist (the cap is enforced server-side) and write private research notes optionally linked to visible universities, programmes, or scholarships.
- **Admin catalog controls:** users with `UNIVERSITIES_READ`/`UNIVERSITIES_MANAGE` can search/filter the 500 records and change verification status from `/admin/universities`; every override writes an `AuditEvent`. Reviewers can also explicitly mark records `Partially verified` or `Information unavailable` in the review queue.
- **Per-fact provenance:** records carry `VERIFIED`, `PARTIALLY_VERIFIED`, `INFORMATION_UNAVAILABLE`, `NEEDS_REVIEW`, `UNVERIFIED`, `EXPIRED`, or `ARCHIVED`; individual fields add `NOT_VERIFIED`. Public views include partially verified and re-review records with visible status banners.
- **Honest unknowns:** a missing tuition figure, deadline, requirement, or official website renders an explicit unknown state. No amount, rank, or date is inferred.
- **Reviewer CRUD:** `/dashboard/review` for `REVIEWER`/`ADMIN`/`SUPER_ADMIN` shows the queue, all records, a data-quality report, and recent decisions. `/dashboard/review/new` creates records with an official source URL and verification date. `/dashboard/review/[entityType]/[id]` edits fields, adds facts, and records decisions. Archiving removes a record from public discovery while preserving source and review history.
- **Audit trail:** every import, edit, approval, change request, expiry, restore, archive, and sweep writes a `CatalogReview` row and an `AuditEvent`.
- **Expiry sweep:** `npm run catalog:expire` moves records past `nextReviewAt` from `VERIFIED` to `NEEDS_REVIEW`, keeping them visible with a warning and never deleting them.
- **Seed data:** hand-verified records for Germany, the United Kingdom, and the Netherlands (4 universities, 4 programs, 2 scholarships, 18 requirement facts) with official source URLs. Coverage and known gaps are documented in [docs/DATA-QUALITY.md](docs/DATA-QUALITY.md).

### Milestone 2 — accounts and safety

- **Database:** PostgreSQL schema and migrations for users, sessions, single-use auth tokens, consent records, student profiles, audit events, and rate-limit counters. Prisma 6.19 with a PostgreSQL target.
- **Registration and sign-in:** email/password registration with Argon2id hashing, Google account sign-in, optional email verification, login, logout, and generic authentication errors.
- **Password recovery:** single-use reset links that expire after 30 minutes, revoke other sessions, and send a notification email.
- **Sessions:** opaque 32-byte tokens, SHA-256 hashed at rest, httpOnly `SameSite=Lax` cookie, 7-day idle expiry with sliding renewal, and a 30-day absolute cap. Sessions can be listed and revoked from account settings.
- **Student profile:** name, nationality, country of residence, current and target degree, up to six fields of study, English test and score, and an optional annual budget with currency.
- **Age gate and guardian consent:** minimum age 13. Students under 18 must name a guardian; the workspace stays locked until the guardian approves through a single-use email link. Consent version and timestamp are stored.
- **Protected workspace:** `/dashboard` and its sub-routes require a server-validated session. Email verification does not block access; minors still need recorded guardian consent before using the workspace.
- **Account settings:** password change with other sessions revoked, active session list and revocation, and account deletion that scrubs personal data while keeping an anonymised audit row.
- **RBAC:** `STUDENT`, `REVIEWER`, `ADMIN`, `SUPER_ADMIN`, and four scoped manager roles (`CONTENT_MANAGER`, `UNIVERSITY_MANAGER`, `SCHOLARSHIP_MANAGER`, `SUPPORT_MANAGER`) with server-side checks. Catalog writes require a reviewer, administrator, or Super Admin.
- **Admin panel:** a separate, `noindex` administration surface lives at `/admin` with its own shell and navigation. Access requires a verified email plus a role and capability re-read from the database on every request. Super Admins can assign roles and individual capability grants at `/admin/access`; administrators can search accounts and revoke sessions at `/admin/users`, and search/filter/change status for the university catalog at `/admin/universities`. Self-demotion, removing the last administrator/Super Admin, and granting admin roles to unverified emails are rejected. Legacy `/dashboard/admin/*` URLs redirect to `/admin/*`.
- **Audit trail:** append-only security events for registration, login, verification, password changes and resets, guardian decisions, profile updates, account deletion, and catalog review. IP addresses are hashed, never stored raw.
- **Rate limiting:** database-backed fixed-window counters keyed by HMAC-hashed email/IP/user identifiers protect sign-in, registration, password reset, resend, guardian decisions, profile writes, password changes, uploads, and deletion. Sign-in counts only failed credential checks and leaves correct passwords usable during a lockout; registration checks run after validation. See [docs/SECURITY.md](docs/SECURITY.md).

### Milestone 4 — student workspace

- **Application tracker:** add a currently public university, move it through nine stages from Interested to Accepted/Rejected/Waitlisted, save notes, deadlines, and 0–100% progress, and inspect append-only status history in a Kanban board.
- **Calendar and overview:** a responsive month calendar and dashboard analytics show active applications, deadlines, document completion, progress by stage, and recent application updates.
- **Private documents:** categorize, rename, complete, preview, link to applications, or delete Passport, Academic transcript, IELTS certificate, SAT score report, Recommendation letter, Personal statement, CV, and Other records. Uploads accept PDF, JPEG, PNG, and WebP up to 5 MB; type signatures are checked and stored outside `public`.
- **Notifications:** in-app application status, upcoming deadline, incomplete-document, and recent scholarship-catalog updates with per-category preferences. Deadline and completion reminders are derived from current workspace data.
- **Ownership and deletion:** workspace pages/actions and document preview verify the signed-in, workspace-eligible student; documents cannot be linked across users. Account deletion removes private object bytes before committing workspace-row deletion.

### Milestone 5 — private file infrastructure

- Document bytes are stored in private S3-compatible buckets, never on local disk or under `public`. Uploads are staged under `quarantine/`, scanned over ClamAV's private INSTREAM service, and promoted to `documents/` only after a clean verdict.
- Authenticated preview continues through the owner-checked application route; no public or presigned object URL is created. Scanner and object-store failures fail closed.
- `npm run db:backup` exports PostgreSQL and copies clean document objects to the separately configured backup bucket. `npm run db:restore` validates the manifest and restores only to explicitly configured recovery targets.
- Production deployment must set up separate private document and backup buckets, block all public access, configure encryption and lifecycle expiration, isolate the scanner, and schedule/monitor backups. See the [file operations runbook](docs/FILE-OPERATIONS.md) and [security documentation](docs/SECURITY.md).

### Milestone 6 — production deployment and operations

- **Deployment:** standalone Next.js output, a non-root production Docker image, dependency-free liveness and PostgreSQL/configuration readiness checks, and CI workflows that gate on dependency audit, lint, typecheck, unit/integration tests, formatting, build, container build, Gitleaks secret scanning, CodeQL SAST, pull-request dependency review, and a Trivy image scan. Actions are pinned to commit SHAs; host-side branch protection and scanner settings remain operator tasks.
- **Monitoring:** structured allowlisted JSON logs redact error messages and sensitive request/user data; Next.js request errors are captured and OpenTelemetry request spans export to a configured collector. Authentication failures, rate-limit failures/denials, storage processing/download failures, and health failures emit operational events.
- **Reliability and security:** production readiness requires HTTPS app URL, PostgreSQL, auth, SMTP, S3, ClamAV, and telemetry configuration. Rate limits fail closed on database failure. Existing owner checks, private/no-store file responses, same-origin mutations, and production security headers remain in place.
- **Performance:** removed a redundant dashboard deadline count query by deriving the metric from already-loaded deadline rows. No shared cache was added for student data; catalog pagination and per-user deadline indexes are retained.
- **Deployment boundary:** this repository does not provision a hosting provider, domain, managed database, S3 buckets, ClamAV, telemetry backend, alert routing, or backup schedule. Verify those in the target environment before production traffic. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

### Milestone 8 — AI Advisor

- **Workspace chat:** `/dashboard/advisor` provides a private conversation view, multi-turn history, new/delete/clear actions, timestamps, titles, feedback, copy, regenerate, staged loading, and safe error/retry states on desktop and mobile.
- **Server-side orchestration:** OpenAI-compatible Chat Completions is the default adapter (`AI_PROVIDER=openai`, `AI_MODEL=gpt-4.1-mini`); Anthropic, OpenRouter, and generic compatible endpoints are also supported. The provider, model, key, and base URL are never controlled by the browser.
- **Grounding:** eleven read-only tools query the signed-in student's own workspace and the 500-university catalog. `classify_shortlist` returns Reach / Target / Likely as planning estimates derived only from stored QS 2027 rank bands, catalog tuition/degree/field facts, and the saved budget — never admission predictions or guarantees. Tool data and student messages are delimited as untrusted data, and the server strips links that were not returned by a tool.
- **Controls:** same-origin authenticated requests, workspace gating, per-user ownership checks, prompt-injection delimiters, Markdown-only rendering with an allowlisted link renderer, per-minute/day message limits, daily cost caps, timeouts, and redacted metrics.
- **Delivery boundary:** v1 returns a complete JSON response rather than streaming. No provider key was configured locally, so live-model quality, latency, and billing must be verified after deployment. See [docs/AI-ADVISOR.md](docs/AI-ADVISOR.md).

Milestone 1 remains in place: the responsive marketing site, the university search preview, trust pages, and the design system.

## Technology

| Layer            | Choice                                                                    |
| ---------------- | ------------------------------------------------------------------------- |
| Framework        | Next.js 16.4 (App Router, Turbopack, `src/proxy.ts`)                      |
| Language         | TypeScript 5.9 (strict)                                                   |
| UI               | Tailwind CSS 4, shadcn-style primitives, Radix UI                         |
| Icons and motion | Lucide, Framer Motion                                                     |
| Charts           | Recharts                                                                  |
| Fonts            | Geist (local package, no network font fetch)                              |
| Database         | PostgreSQL 16+ via Prisma 6.19                                            |
| Local database   | PGlite 0.5 over the PostgreSQL wire protocol (no system install required) |
| Passwords        | Argon2id (`@node-rs/argon2`)                                              |
| Validation       | Zod 4                                                                     |
| Email            | Nodemailer with a console outbox in development and SMTP in production    |
| Deployment       | Next.js standalone output, Docker, OpenTelemetry                          |
| AI provider      | OpenAI-compatible, Anthropic, OpenRouter, or compatible HTTP endpoint     |
| Tests            | Vitest (unit and integration)                                             |
| Linting          | ESLint 9 (flat config), Prettier                                          |
| Planned          | Playwright E2E                                                            |

## Requirements

- Node.js **20.9+** (verified on Node 22.23)
- npm 10+
- No system PostgreSQL, Docker, or `psql` is needed for local development.

## Getting started

```bash
npm install
```

Create the environment files. Next.js reads `.env.local`; the Prisma CLI reads `.env`. You can copy the template to both, or keep a single `.env` for both tools:

```bash
cp .env.example .env.local
cp .env.example .env
```

Generate an `AUTH_SECRET` and paste it into both files:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Start the local database in one terminal and apply migrations in another:

```bash
npm run db:start
npm run db:migrate
npm run dev
```

Open <http://localhost:3000>. The development email transport writes messages (including verification and reset links) to `.data/mail/`.

### Becoming an administrator

There is no public administrator registration or role selector. To create the first Super Admin locally, add your account email to `BOOTSTRAP_ADMIN_EMAILS` in `.env.local` (comma-separated if there are several):

```bash
BOOTSTRAP_ADMIN_EMAILS="you@example.com"
```

Register or sign in with that exact email. The account is promoted to `SUPER_ADMIN`, the grant is written to the audit log, and `/admin` becomes available after the email is verified. Restart the dev server after changing the variable. Once a Super Admin exists, remove the bootstrap value and use `/admin/access` for role and permission changes. A listed email is re-promoted on every sign-in, so remove it before demoting that account.

### Local database notes

- `npm run db:start` runs PGlite, a PostgreSQL build compiled to WebAssembly, and exposes it on `127.0.0.1:5432`. Data is stored in `.data/pglite`, which is git-ignored.
- The development `DATABASE_URL` includes `&pgbouncer=true`. This tells Prisma to use simple queries because PGlite keeps prepared statements across client reconnects. **Remove that parameter when pointing at a managed PostgreSQL instance.**
- Stop the database with `Ctrl+C`. Do not force-kill the process: abrupt termination can corrupt the PGlite data directory. If that happens, delete `.data/pglite`, start the database again, and re-run `npm run db:migrate`.
- If Next.js reports `Can't reach database server at 127.0.0.1:5432`, the `npm run db:start` process is not running; it must stay up alongside `npm run dev`. Restart it and reload the page. After an abrupt stop that left `.data/pglite/postmaster.pid` behind, remove that stale PID file before starting the database again, then confirm that `/dashboard` loads and the catalog benchmarks appear.
- Integration tests start their own PGlite process on a random free port with `.data/pglite-test`; they do not use the development database.

### Scripts

| Command                    | Purpose                                               |
| -------------------------- | ----------------------------------------------------- |
| `npm run dev`              | Start the development server                          |
| `npm run build`            | Production build                                      |
| `npm run start`            | Serve the production build                            |
| `npm run lint`             | ESLint                                                |
| `npm run typecheck`        | TypeScript without emitting                           |
| `npm test`                 | Vitest unit tests                                     |
| `npm run test:watch`       | Vitest in watch mode                                  |
| `npm run test:integration` | Auth, catalog, workspace, and advisor tests on PGlite |
| `npm run test:all`         | Unit and integration suites                           |
| `npm run db:start`         | Start the local PGlite PostgreSQL server              |
| `npm run db:migrate`       | Apply committed Prisma migrations                     |
| `npm run db:generate`      | Regenerate the Prisma client                          |
| `npm run db:push`          | Push the schema without a migration (dev only)        |
| `npm run db:seed`          | Seed the hand-verified catalog records                |
| `npm run db:import:qs`     | Import the cached QS 2027 500-university dataset      |
| `npm run db:verify:qs`     | Verify count, ranks, statuses and seed preservation   |
| `npm run catalog:expire`   | Move records past their review window to re-review    |
| `npm run db:studio`        | Open Prisma Studio                                    |
| `npm run format`           | Prettier write                                        |
| `npm run format:check`     | Prettier check                                        |

## Project structure

```text
prisma/
  schema.prisma           # Authoritative data model
  migrations/             # Committed SQL migrations
scripts/
  dev-db.mjs              # PGlite server over the PostgreSQL wire protocol
  seed-catalog.mts        # Seed hand-verified catalog records
  expire-catalog.mts      # Move stale verified records to re-review
src/
  app/
    (marketing)/          # Public site, trust pages, catalog, shared nav/footer
      universities/       # Catalog list, university detail, program detail
      scholarships/       # Scholarship list and detail
    (auth)/               # Register, login, verify, reset, guardian consent
      actions.ts          # Auth Server Actions (cookies, rate limits, redirects)
    admin/                # Separate administration surface (own shell + RBAC gates)
      actions.ts          # Admin Server Actions (same-origin + permission checks)
      users/              # Account search, roles, session revocation
      access/             # Super Admin role and capability management
      universities/       # Catalog status overrides
    admin-access-denied/  # Friendly gate page (unverified / insufficient role)
    dashboard/            # Protected student and staff workspace
      actions.ts          # Profile, password, session, consent, deletion actions
      admin/              # Legacy admin URLs (redirect to /admin/*)
      advisor/            # AI Advisor page and history actions
      review/             # Catalog review queue, import, record detail, actions
      guardian-consent/   # Resend guardian request
      profile/            # Study profile form
      settings/           # Password, sessions, deletion
    layout.tsx            # Root shell, fonts, theme provider, metadata
    globals.css           # Design tokens and utilities
  components/
    advisor/              # Chat UI, history sheet, safe Markdown renderer
    auth/                 # Auth forms and shared field components
    catalog/              # Provenance badges, source cards, filters, empty states
    dashboard/            # Dashboard shell, navigation, gate banner
    marketing/            # Landing sections and previews
    review/               # Reviewer import, edit, decision, and fact forms
    ui/                   # Reusable primitives
  lib/
    actions/              # Serialisable form state
    admin/                # Admin context, permissions, grants, users, overview, catalog status
    advisor/              # Provider adapters, tools, orchestration, sanitizing, persistence
    auth/                 # Service layer, sessions, tokens, DAL, roles, audit
    catalog/              # Public reads, filters, provenance, review service, seed data
    data/                 # Country, field, degree, and currency options
    demo/                 # Clearly labeled marketing preview + pure filter
    email/                # Transport and message templates
    http/                 # Request context and same-origin checks
    observability/        # Allowlisted structured logs
    security/             # Crypto, password policy, rate limiting
    validation/           # Zod schemas
  proxy.ts                # Cookie-presence redirect for /dashboard
tests/
  unit/                   # Pure helpers, including catalog provenance and filters
  integration/            # End-to-end service tests on a throwaway PGlite
docs/
```

## Environment variables

Copy `.env.example` to `.env.local` and `.env`. Never commit either file.

| Variable                                                                 | Purpose                                                                                                     |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`                                                    | Canonical app URL used in email links and origin checks                                                     |
| `DATABASE_URL`                                                           | PostgreSQL connection string (PGlite locally, managed PostgreSQL in production)                             |
| `AUTH_SECRET`                                                            | 32+ random bytes; peppers rate-limit hashes                                                                 |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                               | Server-only Google OAuth credentials; see the [Google sign-in setup](docs/GOOGLE-OAUTH.md)                  |
| `EMAIL_TRANSPORT`                                                        | `console` (development outbox) or `smtp` (required in production)                                           |
| `EMAIL_FROM`                                                             | Sender address for verification and reset emails                                                            |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE`    | SMTP delivery settings                                                                                      |
| `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_BUCKET`                   | Private S3-compatible document storage                                                                      |
| `STORAGE_BACKUP_BUCKET`, `STORAGE_*` credentials and encryption vars     | Separate private backup bucket and encryption settings                                                      |
| `MALWARE_SCANNER_HOST`, `MALWARE_SCANNER_PORT`                           | Private ClamAV daemon used to scan each upload                                                              |
| `RESTORE_TARGET_NAME`, `RESTORE_DATABASE_URL`, `RESTORE_DOCUMENT_BUCKET` | Explicit recovery targets; restore also requires `BACKUP_ID`, confirmation, and an empty destination bucket |
| `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL`                   | Server-only AI provider/model; see [docs/AI-ADVISOR.md](docs/AI-ADVISOR.md)                                 |
| `AI_TIMEOUT_MS`, `AI_MAX_*`, `AI_MESSAGES_PER_MINUTE`, `AI_DAILY_*`      | Advisor safety, context, and cost limits                                                                    |

`EMAIL_TRANSPORT=console` is rejected in production so verification and reset mail cannot be silently dropped. `.gitignore` excludes `.env*` and `.data/`.

## Data integrity rules

These rules are non-negotiable for the product:

1. Never invent university requirements, tuition, rankings, deadlines, or scholarships.
2. Every important fact stores an official source URL, publishing organization, verification date, and verification state.
3. Rankings only appear with a named source and year.
4. Unverified information is marked or omitted — never presented as fact.
5. AI output distinguishes verified facts, general advice, and unknown information.
6. No admission or funding guarantees.
7. Testimonials and user metrics are published only when real and verifiable.

Read the public-facing methodology at `/data-sources` and [docs/DATABASE.md](docs/DATABASE.md).

## Security and privacy summary

- Passwords use Argon2id with the OWASP baseline (19 MiB, 2 iterations, one lane). Failed logins verify a dummy hash to reduce email-enumeration timing differences.
- Session and email tokens are random 32-byte values. Only SHA-256 hashes are stored; the raw value exists only in the cookie or email link.
- Verification links expire after 24 hours, reset links after 30 minutes, and guardian links after 7 days. Every token is single-use and issuing a new one invalidates older unused tokens for the same purpose.
- Verification, reset, and guardian links render a confirmation page. The token is consumed by a POST Server Action, not by opening the link, so email scanners cannot redeem it.
- Registration returns an explicit "email already registered" response and sends an account-exists email. Login and password reset keep generic responses to avoid account enumeration. This trade-off is documented in [docs/SECURITY.md](docs/SECURITY.md).
- Every mutation re-checks the session and origin on the server. `src/proxy.ts` only performs a fast cookie-presence redirect; it is not the authorization boundary.
- Student document uploads are size/MIME/signature-validated, held outside `public`, served only by an owner-checked route with `nosniff` and `no-store`, and never executed by the application.
- Catalog review pages and Server Actions require `REVIEWER`, `ADMIN`, or `SUPER_ADMIN` on every request. Reviewer and `/admin` pages are `noindex, nofollow`, and no catalog write is reachable from a public route. Admin pages re-read role, email verification, and grants from PostgreSQL on every request.
- Account deletion is a soft delete: sessions, tokens, MFA data, Google links, consent records, workspace rows, and private document bytes are removed; admin grants are dropped or detached; and the retained row is anonymised and reset to `STUDENT`.
- AI Advisor requests are same-origin and authenticated; the browser cannot choose the provider, model, tools, or user scope. Tools are read-only, external answer links are restricted to real catalog sources, and advisor logs contain metrics but no prompts or answers.

## Milestone 5 verification boundary

The app's storage, malware-scan, and backup/restore logic has automated tests. Live S3-compatible storage, a production ClamAV service, and the `pg_dump`/`pg_restore` executables are external deployment dependencies; a managed-environment integration and restore drill are required before production launch.

## Verification performed for Milestone 3

- `npm run typecheck` — passed.
- `npm run lint` — passed with no errors or warnings.
- `npm test` — 110 unit tests passed across 10 files, including catalog provenance, formatting, filter parsing, and seed-data integrity.
- `npm run test:integration` — 38 end-to-end service tests passed (17 auth, 21 catalog) on a fresh throwaway PGlite database.
- `npm run format:check` — passed.
- `npm run build` — production build succeeded; catalog and reviewer routes compiled.
- Browser QA on a real dev server:
  - `/universities` showed the verified records with source links; country, text, and degree filters narrowed the list; an unmatched query showed an honest empty state.
  - University, program, and scholarship detail pages rendered every fact with its source and verification date, and tuition/deadline spacing was corrected.
  - `/scholarships` nationality and funding filters returned only scholarships that state eligibility.
  - The reviewer workspace showed the queue, all-records table, data-quality report, and recent decisions; an empty import form produced human validation messages.
  - `REQUEST_CHANGES` moved a record to `NEEDS_REVIEW`, the public page kept a warning banner, and `APPROVE` restored `VERIFIED` with an `IMPORT → REQUEST_CHANGES → APPROVE` history.
  - No horizontal overflow at 601 px on catalog or reviewer pages; dark mode set `html.class="dark"` and `color-scheme: dark`.
  - The sitemap included catalog entries; public detail pages were `index, follow` with a canonical URL, and staff pages were `noindex, nofollow`.

### Milestone 2 verification

- `npm test` — 46 unit tests passed.
- `npm run test:integration` — 17 end-to-end auth/profile tests passed, repeated twice on a fresh throwaway database.
- Browser QA covered minor registration, gated dashboard, guardian consent approval, profile persistence, password change, password reset, account deletion, staff-only redirects, and theme switching.

Production PostgreSQL was not available in this environment. Migrations and queries were exercised against PGlite, which implements PostgreSQL semantics over the wire protocol; a managed PostgreSQL verification remains a deployment step.

### Milestone 4 verification

- `npm run typecheck` — passed.
- Targeted ESLint on dashboard, workspace service/storage, auth deletion, and navigation — passed.
- `npm test` — 112 unit tests passed, including supported file signatures, MIME spoof rejection, and the 5 MB upload limit.
- `npm run test:integration` — 42 PGlite integration tests passed across auth, catalog, and workspace; workspace tests cover status history, duplicate applications, notification preferences, cross-user document access/linking, and private-file deletion.
- Migration `20261116000200_student_workspace` applied successfully to a fresh PGlite database.
- `npm run format:check` — passed for the changed implementation files.
- `npm run build` — passed; dashboard, application, calendar, notification, and private document routes compiled.

## Milestone 8 verification

- `npm run typecheck` — passed.
- `npm run lint` — passed with no errors or warnings.
- `npm test` — 184 unit tests passed across 27 files, including provider adapters, request validation, link sanitizing, tools, route guards, and allowlisted logging.
- `npm run test:integration` — 60 integration tests passed across 7 files on a fresh PGlite database, including advisor persistence, ownership, tool scoping, source allowlisting, regeneration, provider failure, rate/cost caps, feedback, deletion, and clear history.
- Migration `20261117000200_advisor` applied successfully to a fresh integration database and to the local development database.
- `npm run format:check` — passed.
- `npm run build` — passed; `/api/advisor/chat` and `/dashboard/advisor` compiled in the production build.
- Browser QA at a 429-pixel-wide viewport verified the setup state, history sheet, timestamps, safe citation link, persisted feedback, copy fallback, delete/clear actions, dark-mode persistence, and no document-level horizontal overflow. Live sending and regeneration were disabled because no provider key was configured.
- No `AI_API_KEY` was present locally: provider adapters and orchestration were exercised with injected test doubles, but a live model response, real billing, and provider retention settings remain deployment verification steps. See [docs/AI-ADVISOR.md](docs/AI-ADVISOR.md).

## Documentation

- [AI Advisor](docs/AI-ADVISOR.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Database design](docs/DATABASE.md)
- [API design (current + planned)](docs/API.md)
- [Security and privacy](docs/SECURITY.md)
- [Production deployment](docs/DEPLOYMENT.md)
- [Data quality and provenance](docs/DATA-QUALITY.md)
- [Roadmap](docs/ROADMAP.md)

## License

This project is distributed under the MIT License. See [LICENSE](LICENSE) for
the full license text.

## Next milestone

**Milestone 9 — Admin, trust operations, and privacy tooling.** Build on the advisor's owner-scoped data model and redacted audit events with admin workflows, export/deletion tooling, and public quality reporting. See [docs/ROADMAP.md](docs/ROADMAP.md).
