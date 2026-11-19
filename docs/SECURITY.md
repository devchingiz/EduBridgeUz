# Security and privacy

> **Status: Milestones 2–6 and the Milestone 8 AI Advisor controls are implemented in code.** The site stores accounts, profiles, sessions, consent records, a source-linked catalog, student applications, private document files, and advisor conversations. Production AI/provider configuration, live malware scanning, and a managed database restore drill remain deployment verification tasks.

## Implemented in Milestone 3

### Catalog review authorization

- The review workspace (`/dashboard/review`, `/dashboard/review/new`, `/dashboard/review/[entityType]/[id]`) requires `REVIEWER` or `ADMIN`. The page calls `requireRole` and every Server Action calls it again; a hidden link is never the boundary.
- Catalog writes are only reachable through staff Server Actions. Public catalog pages import read-only query functions and never a write service.
- Every review action calls `assertSameOrigin()` in addition to the session and role check.
- Reviewer pages and the staff overview set `robots: { index: false, follow: false }`.
- Reviewer input is parsed by `src/lib/catalog/review-validation.ts` before Prisma is called. Source and provider URLs must be full `http(s)` URLs; slugs, country codes, degree levels, funding types, dates, and month-day strings are validated. Optional facts JSON is strictly validated, and unknown keys are rejected.
- A record cannot be approved without a primary citation that has a human `verifiedAt` date. The service checks this rather than trusting the form.
- `RESTORE` returns a record to `NEEDS_REVIEW`, never directly to `VERIFIED`, so a restored record still needs a reviewer to confirm it.
- Reviewer history (`CatalogReview`) is append-only. Staff account deletion sets `reviewerId` to `NULL` but keeps the decision, note, and timestamps.

### Staff write rate limiting — deliberate omission

Auth, profile, and consent actions are rate-limited because they are reachable by anonymous or self-service users. Catalog review actions are not rate-limited in Milestone 3. The rationale:

- They require an authenticated `REVIEWER` or `ADMIN` account; there is no public path to them.
- Reviewer throughput is intentionally manual and low-volume; a fixed-window limit could block a legitimate bulk re-verification session.
- Every write is attributable to a staff account and recorded in both `CatalogReview` and `AuditEvent`, which is a stronger control than throttling for this threat model.
- If staff accounts become self-service or the reviewer pool grows, add a per-user write limit before that change ships. This is tracked as a follow-up, not silently accepted.

### Catalog content integrity

- Only `VERIFIED` and `NEEDS_REVIEW` records are public. `UNVERIFIED`, `EXPIRED`, and `ARCHIVED` records are excluded from lists and return `404` on detail routes.
- Detail responses are validated with a Zod schema that requires every fact to carry a source URL, publisher, and verification date. A record that fails validation is withheld and logged instead of rendered partially.
- The expiry sweep only demotes records to `NEEDS_REVIEW`; it never deletes and never auto-approves.
- Reviewer-supplied URLs are stored and linked, not fetched by the server. This avoids turning the review form into an SSRF vector.

## Implemented in Milestone 2

### Password storage and policy

- Passwords are hashed with **Argon2id** through `@node-rs/argon2` using the OWASP baseline: 19 MiB memory, 2 iterations, parallelism 1, 32-byte output. Parameters are stored in the hash string, so they can be raised later without invalidating existing passwords.
- Minimum length is 12 characters; maximum is 128. The policy rejects a small local denylist of common passwords, highly repetitive passwords, and passwords containing the user's email local-part or name.
- Failed logins verify a dummy hash when the account does not exist or has no password, keeping response timing closer to the success path.
- A full breached-password check using the Have I Been Pwned k-anonymity range API is a documented launch gate, not a runtime dependency yet.

### Registration and email verification

- Registration validates name, email, password policy, date of birth, terms acceptance, and guardian details for minors with Zod on the server. The simple form collects one name field and uses a visible-password toggle instead of a second password field; the Server Action supplies the confirmation value to the service schema.
- A verification email is sent immediately. The link contains a random 32-byte token; only its SHA-256 hash is stored.
- Verification tokens expire after **24 hours** and are single-use. Issuing a new token invalidates older unused tokens for the same purpose.
- The verification link renders a confirmation page. The token is consumed by a **POST Server Action**, not by opening the link, so email scanners and link previews cannot redeem it.
- Email verification is optional and does not gate workspace access. Google sign-in accepts only Google identities with a verified email; email/password accounts may use optional verification links.
- Google OAuth uses a single-use, hashed server-side state record, an HttpOnly state cookie, PKCE, a ten-minute attempt expiry, and a server-to-server userinfo request. Only the Google subject is stored as the provider identifier; access tokens are not persisted.
- New Google registrations require terms acceptance and a valid date of birth; the existing minimum-age and guardian-consent rules still apply.

### Login, sessions, and logout

- Login responses are generic (`Invalid email or password.`) whether the email is unknown, deleted, or the password is wrong.
- Application-level IP and email rate limits are intentionally disabled for email/password and Google sign-in, at the user's request, to avoid lockouts after repeated attempts. This leaves credential-stuffing and password-guessing attempts less constrained; production deployments should add edge/WAF protections and monitor failed sign-ins before public launch.
- Sessions use opaque 32-byte tokens. Only a SHA-256 hash is stored in `Session.tokenHash`.
- Cookie: `edubridge_session`, `httpOnly`, `SameSite=Lax`, `Secure` in production, `Path=/`, `Priority=high`.
- Idle expiry is **7 days** and slides while the user is active. The absolute cap is **30 days** from session creation, regardless of activity.
- Session validation rejects revoked, expired, absolutely expired, and soft-deleted users. `lastUsedAt` is written at most once per hour.
- Logout revokes the current session in the database and clears the cookie.
- Account settings list active sessions and allow revoking one session or all other sessions.

### Password reset

- Reset requests always return the same confirmation whether or not an account exists.
- Reset tokens expire after **30 minutes**, are single-use, and are consumed by a POST action.
- A successful reset revokes every session for the account, marks the email verified if it was not already, and sends a password-changed notification.
- Changing a password from account settings requires the current password and revokes all other sessions.

### Rate limiting

Limits for the actions below are database-backed fixed-window counters. Keys are `scope:HMAC-SHA256(identifier)` using `AUTH_SECRET`, so the table never stores raw emails, IPs, or user IDs. The counter update is one atomic upsert shared across server instances. If the database is unavailable, the limiter fails closed with a short retry interval and emits a redacted operational event. This does not apply to sign-in: email/password and Google sign-in currently have no application-level throttling.

Registration counters are applied only after server-side validation and password-policy checks, so correcting a form error no longer consumes an attempt. Registration uses versioned scope names so stale counters from older, stricter limits cannot block a current sign-up, and the shared `unknown` IP sentinel is never used as a counter key. The same IP limit also applies when starting Google sign-up.

| Action              | Identifier          | Limit | Window     |
| ------------------- | ------------------- | ----- | ---------- |
| Registration        | IP (when available) | 20    | 15 minutes |
| Registration        | Email               | 10    | 15 minutes |
| Forgot password     | IP                  | 10    | 1 hour     |
| Forgot password     | Email               | 5     | 1 hour     |
| Reset password      | IP                  | 10    | 1 hour     |
| Resend verification | IP                  | 10    | 1 hour     |
| Resend verification | User                | 5     | 1 hour     |
| Guardian decision   | IP                  | 20    | 1 hour     |
| Profile update      | User                | 30    | 1 hour     |
| Password change     | User                | 5     | 1 hour     |
| Account deletion    | User                | 3     | 1 hour     |

### Authorization and RBAC

- Roles are `STUDENT`, `REVIEWER`, and `ADMIN`, stored server-side. Roles are never accepted from the client.
- `requireUser()` validates the session against the database on every protected page and action.
- `requireRole([...])` protects staff surfaces. `/dashboard/admin` is limited to reviewers and administrators; `/dashboard/admin/users` and role/session mutations are administrator-only.
- The first administrator can be bootstrapped with the server-only `BOOTSTRAP_ADMIN_EMAILS` environment variable. A listed email is promoted on successful registration or sign-in, the grant is audited, and the value is never exposed to the browser. It is a deployment/operator control, not a self-service role selector; remove the value before demoting that account through the panel.
- Role changes re-read the actor's role from the database, reject self-demotion and removal of the last administrator, and write append-only audit events. Reviewer sessions are not sufficient to grant roles.
- `requireWorkspace()` additionally requires recorded guardian consent for minors before private workspace access and writes.
- Layouts are not a security boundary. Each page and Server Action re-checks; `src/proxy.ts` only redirects requests with no session cookie and is documented as a UX optimisation.

### CSRF and request origin

- Session cookies are `SameSite=Lax`.
- Every Server Action calls `assertSameOrigin()`, which compares the `Origin` header host with `X-Forwarded-Host`/`Host` and rejects mismatches.
- Next.js also checks the Origin header for Server Actions. Both checks are defence in depth.

## Implemented in Milestone 4 — student workspace

- Every workspace page and action calls `requireWorkspace()`; service queries use the signed-in user ID for ownership. Application/document linking checks ownership of both records. Private document preview returns `404` for non-owned records.
- Application statuses are constrained to the nine declared enum values; progress is validated from 0–100 and also has a database check. Status transitions are recorded in a separate history table.
- Uploads require a same-origin POST with `Content-Length` no larger than 5 MiB plus multipart overhead. Only PDF, JPEG, PNG, and WebP are accepted, and the server checks magic bytes against the declared MIME type.
- Uploads are throttled to 30 per user and 60 per IP per hour using the database-backed hashed-identifier limiter.
- Files use random server-generated UUID storage keys and private S3 object prefixes. The app never executes uploaded bytes.
- Preview is only available after session, workspace, and ownership checks. Responses are `private, no-store`, `nosniff`, and use an inline allowlisted content type plus a restrictive CSP.
- Document and account deletion remove private object bytes before removing their database metadata. A storage failure stops deletion and preserves the records for retry.
- Notification preferences are stored per user. Deadline and missing-document reminders are derived from current owned records; application status changes create notifications only when enabled.

### Storage and account deletion

- Uploads are written to `quarantine/` as `application/octet-stream`; ClamAV scans the content over its private TCP `INSTREAM` service. A clean verdict is required before the object is copied to `documents/`; infected files remain quarantined and are not added to the student's document list.
- Append-only audit events record scan start and clean, infected, scanner-failed, storage-failed, and metadata-failed outcomes. Events contain status, MIME type, and byte count only; no filename or file bytes.
- Scanner and S3 failures fail closed. Configure an S3 lifecycle expiration rule for the entire `quarantine/` prefix (for example, one day) so infected or interrupted uploads are eventually purged.
- Both buckets must have S3 Block Public Access enabled, no public ACL/policy, and TLS-only access. Grant the app role only required object operations on the `documents/` and `quarantine/` prefixes; grant backup jobs read/list on document objects and write/read only under `backups/`. Never enable website hosting or return presigned/public object URLs.
- Set `STORAGE_SERVER_SIDE_ENCRYPTION=AES256` or `aws:kms` and, for KMS, configure `STORAGE_KMS_KEY_ID` and narrowly scoped key permissions. Keep credentials in the deployment secret manager or provider identity chain, not in source files.
- The authenticated preview handler checks the current workspace session and owner-scoped database row before reading the object. It returns private/no-store, `nosniff`, and sandboxed responses. Staff have no route to read student files.
- Document deletion and account deletion remove object bytes before removing their database metadata. If object deletion fails, the database rows are preserved so cleanup can be retried; database failures after object deletion can leave metadata for an unavailable object, which preview reports as unavailable.
- Schedule `npm run db:backup` with the deployment scheduler, alert on non-zero exit, and retain versioned backups in the distinct private backup bucket. Apply a backup lifecycle/retention policy under `backups/` based on the approved RPO/RTO; failed partial backup prefixes should also expire. Run the restore procedure periodically against a new staging database and document bucket. `npm run db:restore` requires `BACKUP_ID`, `RESTORE_CONFIRM=RESTORE`, `RESTORE_DATABASE_URL`, and `RESTORE_DOCUMENT_BUCKET`; it rejects the configured primary `DATABASE_URL` and validates the manifest before restoring.
- Restore to an isolated database and empty private document bucket first, verify the application and document previews, then perform a separately approved cutover. `pg_dump` and `pg_restore` must be installed on the job host. Define RPO/RTO, backup retention, encryption-key recovery, and access review in deployment operations.

### Minors and guardian consent

- Minimum age is **13**. The date of birth is validated on the server and used only for age rules.
- Students under 18 must provide a guardian name and a different email address at registration.
- A single-use guardian token (7-day expiry) is emailed to the guardian. The guardian page explains what is stored and offers approve/decline actions.
- Approval records `guardianConsentAt`, `guardianConsentVersion`, and a `ConsentRecord` with the policy version. The workspace unlocks on the next request.
- Decline is recorded as an audit event. The workspace stays locked.
- Consent links are consumed by POST, not by opening the link.
- A guardian can withdraw consent by contacting the published privacy address; withdrawal locks the workspace again.

### Account deletion

- Deletion requires the current password and typing `DELETE`.
- Private objects are removed before the database transaction. If cleanup fails, the operation stops and database metadata remains; after object cleanup succeeds, sessions are revoked, related rows are removed, and the user row is anonymised.
- An audit event records the deletion without personal identifiers.
- A scheduled hard delete and export path remain planned for a future privacy milestone.

### Audit logging

- Append-only `AuditEvent` rows record registration, login, email verification, resend, password reset requests and completions, password changes, guardian decisions, profile updates, and account deletion.
- Metadata is redacted and never contains passwords, tokens, or document contents.
- IP addresses are HMAC-hashed with `AUTH_SECRET`; raw addresses are never stored in audit or rate-limit tables.
- Audit failures are logged but do not block the user's action.

### Email

- Development uses the `console` transport, which writes JSON messages to `.data/mail/` (git-ignored).
- Production requires SMTP; `EMAIL_TRANSPORT=console` throws at request time in production so verification and reset mail cannot be silently dropped.
- Email delivery failures do not roll back a correctly created account or password change.

### Account enumeration trade-off

- **Login** and **password reset** return generic responses and are timing-equalised, so they do not reveal whether an email is registered.
- **Registration** returns an explicit `email_taken` response and sends an "account already exists" email to the address. This is a deliberate usability trade-off: a student who forgot they registered should be told to sign in or reset their password rather than being silently dropped. The response still does not disclose any account details.
- **Guardian consent resend** reveals only the guardian address already stored on the signed-in student's own profile.

## Implemented in Milestone 1

- Security headers in `next.config.ts`:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy` disables camera, microphone, geolocation, and browsing topics
  - `Strict-Transport-Security` in production
- `poweredByHeader: false`.
- No secrets in the repository. `.env*` is ignored; `.env.example` contains placeholders only.
- External links use `rel="noopener noreferrer"` and open in a new tab.
- No fabricated trust signals: sample data is labeled, testimonials are a labeled placeholder, statistics describe product capabilities rather than invented traction.
- JSON-LD is serialized with `<` escaped to prevent script-context breakout.

## Known gaps to close before launch

- A Content-Security-Policy is not set yet. Next.js inline scripts and the current styling pipeline need a nonce/hash strategy; add it in the hardening milestone with report-only rollout.
- Breached-password checking (HIBP k-anonymity) is not called at runtime.
- MFA (TOTP, then passkeys) is not implemented. It should ship for administrators and reviewers first.
- Email address change is not implemented yet. When it is, it must require re-authentication and re-verification of both addresses.
- No automated dependency or secret scanning in CI yet.
- No security contact or disclosure policy is published yet.
- Production PostgreSQL was not available in this environment. Migrations and queries were verified against PGlite; a managed PostgreSQL verification remains a deployment step.
- Rate-limit counters are fixed-window, so a small burst at a window boundary is possible. This is acceptable for authentication throttling and is documented above.

## Assets and actors

**Assets:** student identity and contact data, date of birth and guardian consent, study preferences, application plans, private documents, AI conversations, catalog provenance and reviewer history, admin credentials, provider API keys, storage credentials.

**Actors:** anonymous visitor, authenticated student, under-18 student, guardian, reviewer, administrator, external attacker, malicious or compromised AI provider response, abusive scraper.

**Primary risks:** account takeover, horizontal privilege escalation (reading another student's data), document leakage, injection through imported catalog content or AI prompts, minors' data exposure, secret leakage, and reputational harm from presenting unverified facts as true.

## Authorization rules

- Every service function takes the authenticated actor and enforces ownership or role. Route handlers and pages do not rely on middleware alone.
- Students can only read and mutate their own profile, sessions, applications, documents, notifications, and preferences.
- Reviewers can import, edit, and review catalog records and sources, but must not read student documents or conversations.
- Admins can manage roles and revoke sessions in `/dashboard/admin/users`, with every change written to an append-only audit log. Break-glass access to student data requires a documented reason and is audited.
- Unauthorized resource access returns `404` to avoid existence leaks.

## Input, output, and injection

- Validation at every boundary: auth/catalog schemas, workspace enums/dates/ranges, upload metadata and signatures, advisor request schemas/tool arguments, and provider response mapping before display.
- Prisma parameterizes SQL. The only raw SQL is the reviewed, parameterized rate-limit upsert.
- React escapes output by default. `dangerouslySetInnerHTML` is limited to reviewed JSON-LD; user or catalog content is never inserted as HTML.
- URLs supplied by reviewers or users are parsed and restricted to `https:` (and `mailto:` where needed). The server never fetches an arbitrary user-supplied URL without an allowlist, to prevent SSRF.
- File names are display metadata only; storage keys are generated server-side and validated against a strict UUID-plus-extension pattern. No path traversal.
- CSV/formula injection will be handled when exporting spreadsheets.

## Documents and storage (Milestone 5)

- Files are stored outside the web root under private `quarantine/` and `documents/` prefixes using opaque server-generated keys; type/signature checks and a 5 MiB limit are enforced before storage.
- Clean uploads are scanned before promotion; scanner errors never permit an upload. Download is proxied through the authenticated owner-checked route, never through an object URL.
- S3-compatible storage requests use encryption and do not set public ACLs. The provider must enforce bucket privacy, TLS, least privilege, lifecycle retention, and audit logging as described above.
- Backup/restore commands are implemented, but a production provider and recovery drill remain required before launch. Image metadata stripping and automated orphan-object cleanup remain follow-up controls.
- See [FILE-OPERATIONS.md](FILE-OPERATIONS.md) for provider setup, scheduler configuration, retention, scanner configuration, and the isolated-target restore procedure.
- Staff have no route or service to browse student files. Support access remains prohibited without a documented consent/legal process.

## AI advisor (implemented, Milestone 8)

- Provider API keys, base URLs, model selection, tools, and user scope are server-only. The browser sends only a conversation reference, message text, and a regenerate flag; it cannot name a model or provider.
- The advisor context is a minimized, authenticated-student summary: study profile fields, workspace counts, nearest owned deadlines, and bounded history. It never includes another user's data, passwords, guardian contact details, or private document contents. Document tools return names/categories/completion state only.
- Read-only tools execute with the session user ID. There are no write, email, upload, submission, payment, or admin tools, and tool arguments cannot select a different owner.
- Prompt injection is treated as untrusted content: student context and tool output are explicitly delimited and labeled as data, while the static system prompt remains authoritative. Tool results are truncated and cannot grant new instructions or capabilities.
- The server strips dangerous HTML, allows links only to known internal paths or real tool sources, removes fabricated external URLs, and appends server-generated citations with verification dates. The client rechecks hrefs with the same allowlist and renders Markdown without raw HTML.
- Conversations and messages are private to the owner, hard-deletable by the student, and cascaded on account deletion. The usage ledger keeps metadata only; no prompt or answer is duplicated there. Provider training/retention settings remain a deployment review item.
- Same-origin requests, workspace gating, per-minute/day message caps, per-user/global estimated-cost caps, timeouts, and safe mapped errors are enforced. Provider failures keep the persisted student message and expose a recovery conversation ID without leaking provider details.
- The system prompt forbids admission, funding, and visa guarantees and requires students to verify high-impact claims with official sources.
- See [AI-ADVISOR.md](AI-ADVISOR.md) for the full contract and [DATABASE.md](DATABASE.md) for retention details.

## Privacy and data minimization

- Collect the minimum: date of birth is used only to determine age status and is not shown to other users.
- Under-18 accounts require a recorded guardian consent flow before workspace features unlock. Consent records store policy version and timestamp.
- No public student profiles, leaderboards, or social features.
- No behavioural advertising or sale of personal data. Analytics, if added, are privacy-preserving and documented.
- Data minimization for AI: send a bounded profile/workspace summary needed for planning, never file contents or another student's data; full history is limited by `AI_MAX_CONTEXT_MESSAGES`.
- Deletion and export rights apply to minors and guardians.
- The privacy notice must be reviewed for GDPR, UK GDPR, and applicable Uzbek data-protection requirements before launch. Legal review is an explicit launch gate.

## Logging and monitoring

- Structured JSON logs use allowlisted fields and omit error messages, passwords, tokens, session cookies, document contents, AI prompts/answers containing personal data, user identifiers, and full IP addresses. Advisor events include only provider, model, outcome, latency, tool count, token counts, and estimated cost.
- IP addresses are hashed with `AUTH_SECRET` where abuse prevention requires them.
- Audit events record actor, action, entity, timestamp, and redacted metadata.
- Next.js request-error hooks and OpenTelemetry request spans are implemented. Configure the external collector/backend to retain traces and logs and alert on 5xx responses, auth failures, rate-limit storage failures, file-processing failures, readiness failures, and missed backups; alert routing is platform-specific.
- Backups are encrypted, access-controlled, and restore-tested. Define RPO/RTO before production.

## Secrets and environments

- Secrets live in the hosting platform's encrypted environment store, never in git, client bundles, or build logs.
- `NEXT_PUBLIC_*` values are public by definition; no secret may use that prefix.
- `AUTH_SECRET` must be at least 32 characters. Rotating it invalidates HMAC-based rate-limit keys and signs users out only if it is also used for session hashing; sessions use unkeyed SHA-256 of high-entropy tokens.
- Separate development, preview, and production credentials. Rotate after any suspected exposure.
- CI runs typecheck, lint, unit/integration tests, formatting, production build, container build, and a high-severity dependency audit. Secret scanning and branch-protection enforcement remain repository-host configuration tasks.
- The lockfile pins patched transitive `deepmerge-ts` and `minimatch` releases to address the current Prisma-config and ESLint-tree advisories; `npm audit` is run without severity filtering in CI.

## Incident response

1. Contain: revoke sessions/keys, disable the affected path.
2. Assess: scope, data categories, affected users, legal notification duties.
3. Notify: affected users and authorities within required timelines; publish a plain-language post-mortem where appropriate.
4. Remediate: fix, add regression tests, rotate credentials, update this document.
5. Review: blameless retrospective and monitoring improvements.

## Security checklist

- [x] Argon2id password hashing with a documented baseline
- [x] Auth rate limits for registration, reset, resend, guardian decisions, profile writes, password changes, and deletion
- [ ] Sign-in rate limiting or equivalent edge protection (intentionally disabled; production risk documented above)
- [x] Session hashing, idle and absolute expiry, revocation
- [x] Single-use hashed tokens with per-purpose expiry
- [x] Server-side session and role checks on every protected page and action
- [x] Reviewer-only catalog writes with same-origin checks on every action
- [x] Same-origin checks on mutations
- [x] Guardian consent flow tested end to end
- [x] Catalog records and facts require a source with a human verification date
- [x] Append-only catalog review history with staff attribution
- [x] Ownership tests for profile and session operations
- [x] Audit events for security-relevant actions
- [x] Account deletion with PII scrubbing
- [ ] Breached-password check at registration and reset
- [ ] MFA for staff and opt-in for students
- [ ] Email change with dual verification
- [ ] CSP with nonces and report-only rollout
- [x] Private S3-compatible object operations, fail-closed malware scanning/quarantine, and authenticated owner-checked downloads
- [x] Advisor tool-scoping, ownership, timeout, and source-allowlisting tests
- [x] Server-side delimiting of student context and tool output; client link revalidation
- [ ] Dedicated adversarial prompt-injection evaluation set and live-provider red team
- [x] High-severity dependency audit and application checks in CI
- [ ] Secret scanning and required branch-protection rules
- [ ] Backup restore drill on managed PostgreSQL and the production object-storage provider
- [ ] Published security contact and disclosure policy
