# Roadmap

EduBridge is built milestone by milestone. Each milestone must pass its exit checks before the next begins. This prevents a wide, shallow demo and keeps the trust/data rules enforceable.

## Milestone 1 — Foundation and public site (complete)

**Delivered**

- Next.js 16 App Router, TypeScript strict, Tailwind CSS 4, shadcn-style primitives, Geist, Lucide, Framer Motion, Recharts.
- Responsive marketing site with light/dark themes: navbar, hero, university search, how it works, features, scholarships, AI advisor preview, verification principles, testimonial placeholder, FAQ, final CTA, footer.
- Eight hand-checked sample university profiles and tested client-side filtering by text, country, degree, and field.
- Trust pages: `/privacy`, `/terms`, `/data-sources`; 404 and error boundary.
- Security headers, `robots.txt`, sitemap, metadata, JSON-LD.
- README plus architecture, database, API, security, and roadmap documents.

**Verification**

- `npm run typecheck`, `npm run lint`, `npm test` (9 tests), and `npm run build` pass.
- All public routes return `200`; unknown routes return `404`.
- Desktop (1440), laptop (1024), tablet (768/640), and mobile (390/320) layouts have no horizontal document overflow.
- Mobile navigation opens, contains all links, locks body scroll, closes with Escape; desktop navigation replaces it at `lg`.
- Search filters by query, country, degree, and field; clear/reset restores all eight records; empty state appears for no matches.
- Theme toggle cycles light/dark and persists the class.
- No console errors during the interaction pass.
- Lighthouse accessibility, best practices, and SEO each score **100**.

**Not included**

- No database, authentication, live catalog, student workspace, uploads, AI calls, payments, or analytics.
- No fabricated testimonials or traction metrics. The testimonial area is an explicit development placeholder.

## Milestone 2 — Authentication, database, and student profile (complete)

**Goal:** a real account system with a safe first-run experience.

**Delivered**

- PostgreSQL schema and two committed migrations for users, sessions, single-use auth tokens, consent records, student profiles, audit events, and rate-limit counters. Prisma 6.19 targets PostgreSQL; local development and tests run against PGlite over the PostgreSQL wire protocol.
- Email/password registration, optional email verification, login, logout, and password reset, with Server Actions owning cookies, redirects, and audit. Sign-in, registration, and recovery are rate-limited.
- Google OAuth sign-in and registration using the authorization-code flow, state validation, PKCE, verified Google email, and the same database-backed sessions.
- Argon2id hashing (OWASP baseline), password policy, generic login/reset errors, and an explicit duplicate-registration response with an account-exists email.
- Opaque sessions: 32-byte tokens, SHA-256 at rest, httpOnly `SameSite=Lax` cookie, 7-day idle expiry with sliding renewal, 30-day absolute cap, and revocation from account settings.
- Single-use hashed tokens: verification 24 hours, reset 30 minutes, guardian consent 7 days. Links render a confirmation page and are consumed by POST.
- Database-backed fixed-window rate limits keyed by HMAC-hashed email/IP/user identifiers.
- Student profile: nationality, residence country, current/target degree, up to six fields of study, English test and score, optional budget with currency, and guardian contact.
- Age gate (minimum 13) and guardian consent for under-18 accounts. The workspace stays locked until consent is recorded; decline is audited. Email verification does not block workspace access.
- Protected `/dashboard` shell with workspace gating, profile page, account settings (password change, session list/revocation, account deletion), and guardian consent status.
- RBAC foundation: `STUDENT`, `REVIEWER`, `ADMIN` with server-side checks and a read-only `/dashboard/admin` overview for staff.
- Account deletion as an immediate soft delete that revokes sessions and tokens, deletes the profile, and anonymises the user row.
- Append-only audit events for registration, login, verification, resend, password reset/change, guardian decisions, profile updates, and deletion. IP addresses are hashed.
- Documentation updated: README, architecture, database, API, and security.

**Verification**

- `npm run typecheck` — passed.
- `npm run lint` — passed with no errors or warnings.
- `npm test` — 46 unit tests passed.
- `npm run test:integration` — 17 end-to-end service tests passed, repeated twice against a fresh throwaway PGlite database.
- `npm run format:check` — passed.
- `npm run build` — production build succeeded; all routes compiled.
- Browser QA: minor registration, guardian approval, workspace unlock, profile blocked before consent and saved after it, password change, sign-out/sign-in, forgot/reset flow, account deletion and anonymisation, student redirected away from `/dashboard/admin`, and dark-mode toggle.
- Integration coverage includes registration, duplicate email, age gate, guardian consent, optional verification, Google account creation/linking, login, password reset, profile ownership, session revocation, and account anonymisation.

**Not included**

- No public REST API, live catalog, application tracker, document storage, AI advisor, admin moderation tooling, or data export. These belong to Milestones 3–7.
- Production PostgreSQL was not available in this environment. Migrations and queries were exercised against PGlite; managed PostgreSQL verification remains a deployment step.
- No MFA, breached-password lookup, email address change, or Content-Security-Policy during this milestone. MFA, breached-password checks, and a baseline CSP were added in later hardening work; email change remains open. See [SECURITY.md](SECURITY.md).
- Git was unavailable during this milestone, so the CI pipeline was added later in Milestone 6 (see below).

**Exit criteria met:** auth and ownership integration tests pass; the under-18 flow blocks workspace access without consent; no student route renders without a server-side session check; typecheck, lint, unit/integration tests, formatting, and build are green; the auth surface is reviewed in [SECURITY.md](SECURITY.md).

## Milestone 3 — Source-linked catalog and scholarship search (complete)

**Goal:** replace the demo dataset with a reviewed, provenance-first catalog.

- University, program, scholarship, requirement, and source-citation models.
- Reviewer create/read/update/archive workflow requiring an official source URL and verification date. Archive removes a record from public discovery without deleting its citations or audit history.
- Search and filters backed by PostgreSQL; public profile pages with per-fact status and citations.
- Signed-in students can save universities and scholarships and manage saved records from their private favorites page.
- Expiry and re-review jobs; records become `NEEDS_REVIEW` rather than silently stale.
- Clear empty and unknown states; no synthesized tuition, rank, or deadline.
- Initial content for a small set of countries with hand-verified records.

**Verification:** unit and PGlite integration coverage for search/filter behavior, source provenance, CRUD decisions, archive/restore history, and per-user favorites. Typecheck, lint, formatting, unit/integration tests, and production build are required for changes.

**Exit criteria:** no verified fact without a source; provenance response schema tests; reviewer audit trail; catalog pages accessible and indexable; data-quality report reviewed.

## Milestone 4 — Student workspace, applications, and documents (implemented)

**Goal:** one calm place to run applications.

**Delivered**

- Protected student dashboard with profile-completion percentage, active-application counts, upcoming deadlines, document completion, average progress, status analytics, and recent application activity.
- Application tracker for all nine statuses (Interested, Researching, Preparing documents, Ready to apply, Submitted, Interview, Accepted, Rejected, Waitlisted), including add/update/delete, notes, deadlines, progress, append-only status history, and a nine-column Kanban board.
- Responsive month calendar generated from student-owned application deadlines.
- Private document manager for the eight requested categories, with upload, rename, recategorize, completion status, preview, delete, and application linking.
- In-app updates for application status changes, deadlines within 30 days, incomplete documents, and recent public scholarship additions; per-category notification preferences.
- Server-side workspace gating and ownership checks on every page/action and on document bytes. Cross-user document access and linking are integration tested.
- Upload checks for PDF/JPEG/PNG/WebP MIME plus file signature, 5 MiB limit, same-origin POST, randomized storage keys, private storage outside `public`, and safe inline preview headers. Uploaded bytes are not executed.
- Account deletion clears workspace rows after private object cleanup succeeds.

**Verification:** fresh PGlite migration and integration tests, file-signature/size unit tests, typecheck, lint, formatting, and production build. Production PostgreSQL was not available.

**Deployment boundary:** document bytes use private S3-compatible object storage and a fail-closed malware scan/quarantine flow. Provider setup, live scanner availability, and a managed PostgreSQL restore drill remain deployment verification requirements.

## Milestone 5 — Private file infrastructure (implemented)

**Goal:** durable, private document storage with recoverable backups.

- Replaced local document files with private S3-compatible document and backup buckets; credentials are environment/provider supplied.
- Stage uploads in quarantine, validate type/signature/size, scan using ClamAV INSTREAM, and promote only clean files.
- Keep document reads on authenticated owner-checked application routes; never return public or presigned object URLs.
- Preserve ownership on deletion and account cleanup; surface object-store failures without silently deleting database metadata.
- Provide PostgreSQL/document backup and explicit recovery-target restore commands with manifest/key validation.
- Document bucket privacy, encryption, lifecycle, scanner network isolation, scheduling, and restore procedures; test failure, ownership, quarantine, and restore behavior.

**Deployment boundary:** automated coverage uses fake object storage and a local scanner protocol server. A real S3-compatible service, production ClamAV deployment, and managed PostgreSQL backup/restore drill must be verified before launch.

## Milestone 6 — production deployment, monitoring, and performance (implemented)

**Delivered**

- Standalone Next.js output and a non-root production Docker image with a `SIGTERM` stop signal and liveness health check.
- `/api/health/live` and `/api/health/ready` endpoints; readiness validates production configuration and checks PostgreSQL without exposing error details.
- Structured, allowlisted JSON logs; Next.js request-error capture and OpenTelemetry request tracing; explicit events for authentication, rate limiting, storage, and health failures.
- Production readiness validation for HTTPS origin, PostgreSQL, auth secret, SMTP, private object storage, ClamAV, and OTLP export.
- GitHub Actions checks for dependency audit, lint, TypeScript, unit/integration tests, formatting, production build, Docker image build, Gitleaks secret scanning, CodeQL SAST, pull-request dependency review, and a Trivy image scan with SARIF upload. Actions are pinned to commit SHAs and Dependabot proposes weekly npm/action updates; branch protection and host scanner settings remain operator tasks.
- Fail-closed rate limiting when the database counter cannot be updated and removal of a redundant dashboard query.
- Deployment, environment, monitoring, health-check, and recovery guidance in [DEPLOYMENT.md](DEPLOYMENT.md).

**Deployment boundary**

The repository does not provision a cloud account, DNS/TLS, managed PostgreSQL, object storage, ClamAV, telemetry collector, alert routing, backup scheduler, or branch protection. Verify those services, realistic load behavior, and a production-provider restore drill before routing production traffic.

## Milestone 8 — AI advisor (implemented)

**Goal:** grounded, honest guidance with a configurable provider.

- **Delivered:** OpenAI-compatible, Anthropic, OpenRouter, and compatible-endpoint adapters configured only by server environment variables; a non-streaming JSON v1 contract; static system prompt with delimited student context and untrusted tool output.
- **Delivered:** ten read-only tools scoped to the session user; server-side source allowlisting, dangerous-HTML stripping, Markdown-only rendering, and server-generated citations from real tool sources.
- **Delivered:** private conversation/message/usage persistence, ownership checks, delete/clear actions, feedback, copy, regenerate, bounded history, timeouts, safe errors, and recovery conversation IDs.
- **Delivered:** same-origin route guard, workspace gate, per-minute/day message limits, estimated per-user/global daily cost caps, allowlisted metrics, and metadata-only usage ledger.
- **Verified:** provider adapters, validation, sanitizing, tools, route behavior, persistence, ownership, tool scoping, source allowlisting, regeneration, provider failure, rate/cost caps, feedback, deletion, and clear history are covered by unit and PGlite integration tests.
- **Boundary:** no live `AI_API_KEY` was available, so a real model response, billing, provider outage behavior, and retention settings remain deployment checks. A dedicated adversarial prompt-injection evaluation set and streaming responses remain future work. See [AI-ADVISOR.md](AI-ADVISOR.md).

## Milestone 9 — Admin, trust operations, and privacy tooling

**Goal:** operate the catalog and respect user rights.

- Admin dashboard for review queues, sources, expired records, reports, and user roles.
- Append-only audit log with redacted metadata and support-access reasons.
- Data export and deletion jobs; consent history.
- Operational alerts for stale records, auth abuse, upload failures, and AI cost.
- Read-only public status/data-quality page generated from real counts.

**Exit criteria:** RBAC tests for every admin action; export/deletion verified end to end; audit events written for mutations; no student documents visible to reviewers/admins without a documented flow.

## Milestone 10 — Hardening, localization, and launch

**Goal:** production readiness.

- Playwright E2E: registration, verification, guardian consent, authorization boundaries, uploads, search, AI failure states.
- Accessibility audit (keyboard, screen reader, contrast, reduced motion) and fixes; Lighthouse targets reviewed.
- Strict CSP with nonces, report-only rollout, and a violation collector. A baseline enforcing CSP and CI dependency, secret, SAST, and container scans are already in place.
- Uzbek and Russian localization with `next-intl`, localized metadata, dates, and currency; English fallback.
- Performance budgets, image/video optimization, cache headers, error monitoring.
- Legal review (GDPR/UK GDPR/Uzbek requirements), published security contact and disclosure policy, final privacy notice.
- Deployment runbook, backups, restore test, and incident response contacts.

**Exit criteria:** E2E suite green in CI; accessibility issues closed or documented; CSP enforced without breakage; localization reviewed by native speakers; legal sign-off; rollback plan tested.

## Administration panel program (new, in progress)

The complete administration system is delivered as eleven separate milestones on the **existing PostgreSQL/Prisma stack**. MongoDB is deliberately not introduced: all current accounts, catalog records, applications, AI usage, and migrations already live in PostgreSQL, and preserving them takes priority over changing databases.

**Milestone 1 — Admin authentication, Super Admin initialization, and permissions (complete)**

- Expanded the existing `Role` enum with `SUPER_ADMIN` and the scoped `CONTENT_MANAGER`, `UNIVERSITY_MANAGER`, `SCHOLARSHIP_MANAGER`, and `SUPPORT_MANAGER` roles; existing `STUDENT`, `REVIEWER`, and `ADMIN` rows are untouched.
- Added `AdminPermission` and `AdminPermissionGrant` so a Super Admin can grant individual capabilities on top of role defaults. Role management itself can never be granted through a capability grant.
- Added a separate `/admin` surface with its own shell, navigation, and `noindex` pages. Legacy `/dashboard/admin/*` routes redirect to `/admin/*`.
- `requireAdminPermission()` re-reads role, verified-email state, deletion state, and grants from the database on every request. Every admin Server Action re-checks its own capability and origin.
- `BOOTSTRAP_ADMIN_EMAILS` now promotes to `SUPER_ADMIN`. Only a Super Admin can change roles or grant/revoke capabilities; self-changes, last-admin/last-Super-Admin removal, and admin roles for unverified emails are rejected.
- Initial screens: `/admin` overview, `/admin/users`, `/admin/access`, `/admin/universities`, and the `/admin-access-denied` gate. The overview shows real database counts; no demo statistics are used.

**Verification:** formatting, lint, TypeScript, 288 unit tests, 85 integration tests, and the production build pass. Browser QA covered all admin pages, role/capability boundaries, distinct denial reasons, legacy redirects with query preservation, role changes, permission grant/revoke, university status overrides with audit events, and zero console errors. QA-only accounts were removed; original accounts remain unchanged.

**Milestone 2 — live overview analytics and charts (complete)**

- Replaced the read-only overview with database-derived platform totals: universities, scholarships, programs, applications, AI conversations/requests, and estimated AI cost.
- Added pure aggregation helpers that zero-fill a continuous 90-day UTC daily series. Quiet days stay at zero; no sample, cached, or fabricated statistics are rendered.
- Added an interactive Recharts activity chart with 7/30/90-day ranges and toggleable real series (new accounts, applications, audit events, AI requests).
- Added interactive status breakdown charts for universities, scholarships, and applications, with selectable bars, count details, and a filtered university link.
- Gated every metric and chart behind the same server-read permissions as the rest of the admin panel. Audit events and the AI series require `AUDIT_READ` and `AI_READ`; manager roles see only their own domains.
- No new tables or migrations: all data is recalculated from existing PostgreSQL rows on every request, and public catalog changes flow through the same queries.

**Verification:** formatting, lint, TypeScript, 292 unit tests, 86 integration tests across 11 files, and the production build pass. Browser QA covered Super Admin range/series toggles, bar selection and the filtered university link, Content Manager scoping, Student denial with reason, and zero console errors. Temporary QA accounts were removed; original accounts were not modified.

**Milestone 3 — university management (complete)**

- Added `/admin/universities`, `/admin/universities/new`, `/admin/universities/[id]`, and `/admin/universities/export` behind `UNIVERSITIES_READ`/`UNIVERSITIES_MANAGE`. The raw verification-status override action and its UI were retired; all status changes now use controlled publish/unpublish/archive/restore transitions with review and audit events.
- Full university editor with server-side validation for every field, source verification details, duplicate detection on normalized name + city + country, and a missing-information warning panel.
- Lifecycle rules reuse existing `VerificationStatus`: publish requires a verified primary source, unpublish clears the featured flag, and restore from archived returns to unpublished rather than silently republishing.
- Feature/unfeature is explicit and server-enforced: only published, sourced records can be featured. `featured` is exposed to public catalog ordering, dashboard discovery, and AI university search.
- CSV export with spreadsheet-formula neutralization and CSV import with all-row validation, a 200-row cap, and duplicate checks before any write.
- One additive migration added `featured` fields and indexes to `University` and `Scholarship`; no records were rewritten or removed.

**Verification:** formatting, lint, TypeScript, 304 unit tests across 41 files, 92 integration tests across 12 files, and the production build pass. A fresh PGlite setup applied all 15 migrations cleanly. Browser QA covered create/publish, warning counts, feature/unfeature plus blocking of featuring unpublished records, unpublish/archive/restore state transitions, duplicate rejection, CSV import, public featured badge, University Manager scoped access, Scholarship Manager and Student denial reasons, and no relevant console errors. Temporary QA accounts and catalog rows were removed; original accounts remain unchanged.

**Milestone 4 — scholarship management (complete)**

- Added `/admin/scholarships`, `/admin/scholarships/new`, `/admin/scholarships/[id]`, and `/admin/scholarships/export` behind `SCHOLARSHIPS_READ`/`SCHOLARSHIPS_MANAGE`, with a scoped nav item and an overview management card.
- Full scholarship editor reusing the shared reviewer field and source contracts, with server-side validation for every stored profile field, normalized multi-value inputs, duplicate detection on normalized name + provider, source verification details, and a missing-information warning panel.
- Lifecycle controls reuse existing `VerificationStatus`: publish requires a verified primary source and passes provenance checks, unpublish clears the featured flag, and restore from archived returns to unpublished rather than silently republishing.
- Feature/unfeature is explicit and server-enforced: only published, sourced scholarships can be featured. Public and dashboard scholarship lists order featured records first and display a `Featured` badge; AI-facing scholarship snippets expose `featured`.
- CSV export with spreadsheet-formula neutralization and CSV import with all-row validation, a 200-row cap, duplicate checks, and support for omitted optional country columns. No new migration was needed.

**Verification:** formatting, lint, TypeScript, 308 unit tests across 42 files, 99 integration tests across 13 files, and the production build pass. A fresh PGlite setup applied all 15 migrations cleanly. Browser QA covered create/publish, warnings, feature/unfeature plus blocking of featuring unpublished records, unpublish/archive/restore state transitions, duplicate rejection, CSV import/export, public and dashboard featured reflection, scoped University Manager denial, Student denial reasons, and no relevant console errors. Temporary QA accounts and catalog rows were removed; original accounts remain unchanged.

**Milestone 5 — CMS and homepage editor (complete)**

- Added an additive `HomepageContent` singleton with a strict Zod contract for hero, search, process, features, scholarship and AI sections, calls to action, and metadata. Arbitrary HTML, scripts, and styles are rejected; only controlled values reach public components.
- Added `/admin/content` behind `CONTENT_READ`/`CONTENT_MANAGE`, with a save Server Action, revision counter, audit events, and cache-tag invalidation for immediate public reflection.
- Refactored ten marketing sections to read the cached published configuration with `unstable_cache` tagged `homepage-content`; the homepage route awaits `connection()` before the cached read.
- Reused `VerificationStatus` for lifecycle: `VERIFIED` is published, `UNVERIFIED` is unpublished, and `ARCHIVED` is archived. `siteConfig` navigation, footer, and SEO are deliberately unchanged and belong to Milestone 6.
- Added a no-network, source-validating scholarship import pipeline. Five official-source batches added 100 real scholarships (102 catalog total), each with a required `SourceCitation`, `VERIFIED` status, an `IMPORT` review row, and an audit event. Closed and archived programs state that explicitly in their public summaries.
- Added `npm run db:import:scholarships` and `npm run db:verify:scholarships`; the verifier confirmed 100/100 written rows, no missing rows, no mismatches, and no duplicate name/provider pairs.

**Verification:** formatting, lint, TypeScript, 315 unit tests across 43 files, 103 integration tests across 14 files, and the production build pass. Browser QA covered Content Manager save, revision increments, immediate public reflection, markup rejection without revision change, and zero console errors. Authorization QA confirmed University Manager and Scholarship Manager receive `?reason=permission`, Student receives `?reason=account`, and unverified Admin receives `?reason=unverified`. The final scholarship dry run validated 100 records with zero errors and zero duplicates.

**Remaining milestones:** (6) branding, navigation, footer, and SEO; (7) media library and educational content; (8) user and application management; (9) AI Advisor management; (10) notifications, audit logs, and global settings; (11) security/integration testing and deployment preparation.

Each milestone must pass typecheck, lint, formatting, unit tests, integration tests, and a production build before the next begins.

## Cross-cutting rules

1. Never fabricate a fact, testimonial, ranking, deadline, or statistic. Unknown is shown as unknown.
2. Every verified fact has an official source, publisher, verification date, and status.
3. Authorization is enforced server-side on every request, not hidden in UI.
4. Student documents and conversations are private by default.
5. Minors receive stricter consent, minimization, and deletion handling.
6. AI output is grounded, cited, and never a guarantee.
7. Typecheck, lint, tests, and production build are required before a milestone is called complete.

## Explicit non-goals for the near term

- Social feeds, public student profiles, or leaderboards.
- Paid agent/consultancy services or admission guarantees.
- A native mobile app (the responsive web app comes first).
- A custom search cluster, microservices, or a separate backend before scale requires it.
- Publishing unverified scraped data to fill catalog pages.
