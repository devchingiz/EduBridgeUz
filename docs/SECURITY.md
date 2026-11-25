# Security and privacy

> **Status: Milestones 2–6 and the Milestone 8 AI Advisor controls are implemented in code.** The site stores accounts, profiles, sessions, consent records, a source-linked catalog, student applications, private document files, and advisor conversations. Production AI/provider configuration, live malware scanning, and a managed database restore drill remain deployment verification tasks.

## Implemented in Milestone 3

### Catalog review authorization

- The review workspace (`/dashboard/review`, `/dashboard/review/new`, `/dashboard/review/[entityType]/[id]`) requires `REVIEWER`, `ADMIN`, or `SUPER_ADMIN`. The page calls `requireRole` and every Server Action calls it again; a hidden link is never the boundary.
- Catalog writes are only reachable through staff Server Actions. Public catalog pages import read-only query functions and never a write service.
- Every review action calls `assertSameOrigin()` in addition to the session and role check.
- Reviewer pages and the staff overview set `robots: { index: false, follow: false }`.
- Reviewer input is parsed by `src/lib/catalog/review-validation.ts` before Prisma is called. Source and provider URLs must be full `http(s)` URLs; slugs, country codes, degree levels, funding types, dates, and month-day strings are validated. Optional facts JSON is strictly validated, and unknown keys are rejected.
- A record cannot be approved without a primary citation that has a human `verifiedAt` date. The service checks this rather than trusting the form.
- `RESTORE` returns a record to `NEEDS_REVIEW`, never directly to `VERIFIED`, so a restored record still needs a reviewer to confirm it.
- Reviewer history (`CatalogReview`) is append-only. Staff account deletion sets `reviewerId` to `NULL` but keeps the decision, note, and timestamps.

### Staff write rate limiting — deliberate omission

Auth, profile, and consent actions are rate-limited because they are reachable by anonymous or self-service users. Catalog review actions are not rate-limited in Milestone 3. The rationale:

- They require an authenticated `REVIEWER`, `ADMIN`, or `SUPER_ADMIN` account; there is no public path to them.
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
- Registration, password reset, and password change also query the Have I Been Pwned k-anonymity range API. Only the first five characters of the SHA-1 digest are sent; the password and full digest never leave the process. Responses are parsed strictly, cached by prefix for 12 hours with a fixed 256-prefix bound, and requested with a 2.5-second timeout. Production fails closed: a network error, non-200 response, or oversized body rejects the password. Outside production the check is opt-in with `HIBP_ENABLED=true`.

### Registration and email verification

- Registration validates name, email, password policy, date of birth, terms acceptance, and guardian details for minors with Zod on the server. The simple form collects one name field and uses a visible-password toggle instead of a second password field; the Server Action supplies the confirmation value to the service schema.
- A verification email is sent immediately. The link contains a random 32-byte token; only its SHA-256 hash is stored.
- Verification tokens expire after **24 hours** and are single-use. Issuing a new token invalidates older unused tokens for the same purpose.
- The verification link renders a confirmation page. The token is consumed by a **POST Server Action**, not by opening the link, so email scanners and link previews cannot redeem it.
- The confirmation page sends `Referrer-Policy: no-referrer`, removes the token from the current browser history entry with `history.replaceState`, and loads no third-party scripts or analytics. Tokens are never written to structured logs or included in user-facing errors.
- Email verification gates workspace access. `getVerificationRequirement()` derives one fixed deadline from `EMAIL_VERIFICATION_ENFORCEMENT_START` plus a 30-day grace window; unverified accounts created after the start, or still unverified after the deadline, are redirected to `/verify-email`. A missing or malformed start value fails closed (verification required), and production readiness rejects an invalid value. Google sign-in accepts only Google identities with a verified email.
- The dashboard shows a non-blocking verification banner derived directly from `User.emailVerifiedAt` on the server. It reuses the existing resend action and its rate limits, and successful verification invalidates the dashboard layout cache so the banner disappears without adding another verification flag.
- Google OAuth uses a single-use, hashed server-side state record, an HttpOnly state cookie, PKCE, a ten-minute attempt expiry, and a server-to-server userinfo request. Only the Google subject is stored as the provider identifier; access tokens are not persisted.
- New Google registrations require terms acceptance and a valid date of birth; the existing minimum-age and guardian-consent rules still apply.

### Login, sessions, and logout

- Login responses are generic (`Email or password is incorrect.` or the shared throttling message) whether the email is unknown, deleted, or the password is wrong.
- Email/password sign-in is throttled by email and IP after failed credential checks. A non-consuming counter read stops further password guesses once a limit is reached, while a correct password still signs in during a lockout. Google sign-in uses single-use OAuth state, PKCE, and Google's verified email check instead of password counters.
- Sessions use opaque 32-byte tokens. Only a SHA-256 hash is stored in `Session.tokenHash`.
- Cookie: `edubridge_session`, `httpOnly`, `SameSite=Lax`, `Secure` in production, `Path=/`, `Priority=high`.
- Idle expiry is **7 days** and slides while the user is active. The absolute cap is **30 days** from session creation, regardless of activity.
- Session validation rejects revoked, expired, absolutely expired, and soft-deleted users. `lastUsedAt` is written at most once per hour.
- Logout revokes the current session in the database and clears the cookie.
- Account settings list active sessions and allow revoking one session or all other sessions.

### Multi-factor authentication (MFA)

- MFA is opt-in for every account in Account settings (`/dashboard/settings`). Enrollment generates a random 160-bit TOTP secret and eight recovery codes; the plaintext is returned once to the enrolling user and is never written to a URL, log, or the database. Only AES-256-GCM ciphertext of the secret and SHA-256 hashes of the recovery codes are persisted.
- Enrollment is not active until a live six-digit code from the authenticator is confirmed. Re-enrollment is rejected while MFA is enabled, so a cross-site request cannot silently replace a second factor.
- With MFA enabled, a correct password issues only a five-minute, single-use challenge stored as a SHA-256 hash in the existing `AuthToken` table. The raw challenge travels in an HttpOnly, `SameSite=Lax`, `Secure`-in-production cookie (`edubridge_mfa_challenge`) and never appears in a URL, referrer, or browser history. No session is created until `/mfa` verifies a TOTP or unused recovery code.
- The challenge is consumed only after a valid factor; failed codes are audited and rate limited (IPv4/IPv6 address plus a hashed challenge identifier) but do not burn the challenge. Recovery codes are single-use and their use is audited. A recovery code may also disable MFA.
- Disabling MFA requires a current TOTP or recovery code, then removes the secret and all recovery codes. Enrollment, confirmation, disablement, successful verification, failed verification, and recovery use all emit audit events.
- `MFA_ENCRYPTION_KEY` (32+ characters) is required in production readiness. It is separate from `AUTH_SECRET` so rotating sessions does not invalidate enrolled secrets; losing or changing it without a migration plan locks enrolled accounts out. MFA mandatory enforcement is deliberately **not** enabled yet, and Google sign-in currently bypasses the password challenge — both must be resolved before MFA can be treated as a mandatory control.

### Password reset

- Reset requests always return the same confirmation whether or not an account exists.
- Reset tokens expire after **30 minutes**, are single-use, and are consumed by a POST action.
- A successful reset revokes every session for the account, marks the email verified if it was not already, and sends a password-changed notification.
- Changing a password from account settings requires the current password and revokes all other sessions.

### Rate limiting

Limits for the actions below are database-backed fixed-window counters. Keys are `scope:HMAC-SHA256(identifier)` using `AUTH_SECRET`, so the table never stores raw emails, IPs, or user IDs. The counter update is one atomic upsert shared across server instances. If the database is unavailable, the limiter fails closed with a short retry interval and emits a redacted operational event.

Sign-in checks counters before verifying a password, but only writes a counter after a failed credential check. Successful sign-ins and malformed form submissions do not consume attempts. This avoids both easy account lockouts and expensive hash verification after a limit is reached. Edge/WAF protections and failed-login monitoring are still recommended before public launch.

Registration counters are applied only after server-side validation and password-policy checks, so correcting a form error no longer consumes an attempt. Registration uses versioned scope names so stale counters from older, stricter limits cannot block a current sign-up. The same IP limit also applies when starting Google sign-up.

IP-derived limits use only syntactically valid IPv4/IPv6 values. Missing, whitespace-only, `"unknown"`, and malformed addresses are treated as unavailable: the IP counter is skipped, but email and reset-token counters still apply. Forwarded headers are best-effort; application code cannot prove they were set by a trusted proxy, so the ingress must overwrite client-supplied forwarded headers as described in `docs/DEPLOYMENT.md`.

| Action              | Identifier          | Limit | Window     |
| ------------------- | ------------------- | ----- | ---------- |
| Sign-in             | IP (when available) | 30    | 15 minutes |
| Sign-in             | Email               | 10    | 15 minutes |
| Registration        | IP (when available) | 20    | 15 minutes |
| Registration        | Email               | 10    | 15 minutes |
| Forgot password     | IP (when available) | 10    | 1 hour     |
| Forgot password     | Email               | 5     | 1 hour     |
| Reset password      | IP (when available) | 10    | 1 hour     |
| Reset password      | Token (hashed)      | 5     | 1 hour     |
| Resend verification | IP (when available) | 10    | 1 hour     |
| Resend verification | User                | 5     | 1 hour     |
| Guardian decision   | IP                  | 20    | 1 hour     |
| Profile update      | User                | 30    | 1 hour     |
| Password change     | User                | 5     | 1 hour     |
| Account deletion    | User                | 3     | 1 hour     |

### Authorization and RBAC

- Roles are `STUDENT`, `REVIEWER`, `ADMIN`, `SUPER_ADMIN`, `CONTENT_MANAGER`, `UNIVERSITY_MANAGER`, `SCHOLARSHIP_MANAGER`, and `SUPPORT_MANAGER`, stored server-side in PostgreSQL. Roles are never accepted from the client or trusted from a session DTO.
- `requireUser()` validates the session against the database on every protected page and action.
- The administration panel is a separate `/admin` surface. `requireAdminPermission(capability)` re-reads the account's role, `emailVerifiedAt`, `deletedAt`, and explicit `AdminPermissionGrant` rows on every request. Unverified emails, deleted accounts, and non-admin roles are rejected with a redirect to `/admin-access-denied`.
- Every admin page and Server Action names the capability it needs (`ADMIN_ACCESS`, `USERS_READ`, `UNIVERSITIES_MANAGE`, and so on). Hidden navigation is never the boundary. Role defaults are declared in `src/lib/admin/permissions.ts`; grants can add capabilities but can never grant Super Admin role management to another account.
- The first Super Admin can be bootstrapped with the server-only `BOOTSTRAP_ADMIN_EMAILS` environment variable. A listed account is promoted only after its email is verified and it signs in successfully; the grant is audited and the value is never exposed to the browser. Production readiness rejects placeholder addresses in this list. It is a deployment/operator control, not a self-service role selector; remove the value before demoting that account through the panel.
- Only a Super Admin can create or promote administrators and grant or revoke individual capabilities. Services re-read the actor from the database, reject self-changes, reject granting admin roles to unverified accounts, and protect the last administrator and last Super Admin. All changes write append-only audit events.
- `requireWorkspace()` additionally requires recorded guardian consent for minors before private workspace access and writes.
- Layouts are not a security boundary. Each page and Server Action re-checks; `src/proxy.ts` only redirects requests with no session cookie on `/dashboard/*` and `/admin/*` and is documented as a UX optimisation.

### CSRF and request origin

- Session cookies are `SameSite=Lax`.
- Every Server Action and cookie-authenticated Route Handler calls `assertSameOrigin()`. It compares the `Origin` host against the configured public app origin and the browser-controlled `Host` header. `X-Forwarded-Host` is deliberately not trusted, because a client can set it when the ingress forwards headers unchanged. A configured HTTPS origin also rejects HTTP `Origin` values.
- Next.js also checks the Origin header for Server Actions. Both checks are defence in depth. Forwarded-IP and forwarded-host headers still require ingress sanitisation as documented in `docs/DEPLOYMENT.md`; application-side syntax validation cannot prove their authenticity.

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
- A single-use guardian token (7-day expiry) is emailed to the guardian. The guardian page explains what is stored and offers approve/decline actions. The token lives in the path, but the route sends `Referrer-Policy: no-referrer` and the client replaces the token with a non-secret path in the address bar and current history entry after the hidden form field has captured it. Tokens are never logged or stored in plaintext.
- Approval records `guardianConsentAt`, `guardianConsentVersion`, and a `ConsentRecord` with the policy version. The workspace unlocks on the next request.
- Decline is recorded as an audit event. The workspace stays locked.
- Consent links are consumed by POST, not by opening the link.
- A guardian can withdraw consent by contacting the published privacy address; withdrawal locks the workspace again.

### Account deletion

- Deletion requires the current password and typing `DELETE`.
- Private objects are removed before the database transaction. If cleanup fails, the operation stops and database metadata remains; after object cleanup succeeds, a single transaction revokes sessions and deletes all user-owned rows: tokens, MFA recovery codes, Google account links, consent records, favourites, applications (with their status events and document links), documents, notifications, preferences, profile, comparison, study notes, advisor usage, advisor conversations and their messages, and this user's admin permission grants. Grants this administrator gave to other users survive with `grantedById` detached, so deletion cannot silently remove someone else's access.
- The retained `User` row is anonymised (opaque email in `.invalid`, generic name, no password hash, date of birth, verification timestamp, TOTP secret, or MFA enablement) and reset to `STUDENT`, so a deleted administrator cannot retain privileges. Append-only audit and catalog-review history are retained with opaque IDs; the catalog decisions remain attributable to an anonymised record rather than being rewritten.
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
- SMTP sends use bounded exponential retries for transient failures and reuse the same prepared message, so retries never generate a new verification or reset token. Permanent errors and failures after the SMTP body phase are not retried to avoid duplicate delivery.
- Retry and final failure events are structured and contain only safe metadata such as the message tag, attempt, delay, and error code. Email delivery failures do not roll back a correctly created account or password change.

### Account enumeration trade-off

- **Login** and **password reset** return generic responses and are timing-equalised, so they do not reveal whether an email is registered.
- **Registration** sends an "account already exists" email with sign-in and password-reset links, then returns the same redirect as a successful registration. Recovery instructions are delivered by email rather than in the response, so the public response, status code, and redirect target do not disclose whether the address was registered.
- **Guardian consent resend** reveals only the guardian address already stored on the signed-in student's own profile.

## Implemented in Milestone 1

- Security headers in `next.config.ts`:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy` disables camera, microphone, geolocation, and browsing topics
  - `Strict-Transport-Security` in production
  - An enforcing `Content-Security-Policy` (see "Known gaps to close before launch" for its current limitations)
- `poweredByHeader: false`.
- No secrets in the repository. `.env*` is ignored; `.env.example` contains placeholders only.
- External links use `rel="noopener noreferrer"` and open in a new tab.
- No fabricated trust signals: sample data is labeled, testimonials are a labeled placeholder, statistics describe product capabilities rather than invented traction.
- JSON-LD is serialized with `<` escaped to prevent script-context breakout.

## Known gaps to close before launch

- An enforcing Content-Security-Policy is now sent on every response. It blocks plugins, base-tag hijacking, framing, and unexpected cross-origin connections, but `script-src`/`style-src` still include `'unsafe-inline'` because Next.js injects inline runtime code and the catalog pages embed inline JSON-LD data blocks. A strict nonce-based policy remains open: it would require forcing every page to dynamic rendering and threading a per-request nonce into those data blocks. No CSP report collector is configured, so no report-only rollout telemetry is available yet.
- Breached-password checking requires outbound HTTPS access to `api.pwnedpasswords.com`; production blocks password changes if that egress is unavailable. Confirm the provider's acceptable-use terms and monitoring before launch.
- MFA is opt-in and its challenge path is tested, but mandatory enforcement is not enabled and the Google sign-in path does not yet require a second factor. Administrators and reviewers should enroll first; mandatory enforcement and provider sign-in coverage remain deployment policy decisions. Passkeys are not implemented.
- Email address change is not implemented yet. When it is, it must require re-authentication and re-verification of both addresses.
- CI now runs dependency, secret, SAST, and container scans, but branch protection, repository-host scanner settings, and a managed-provider restore drill remain external requirements (see `docs/DEPLOYMENT.md`).
- Security and privacy contacts are published at `/security` from `SECURITY_CONTACT_EMAIL` and `PRIVACY_CONTACT_EMAIL`; the operator must verify the mailboxes are monitored and approve response targets and safe-harbour terms.
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
- Super Admins manage roles and capability grants in `/admin/access`; administrators can search accounts and revoke sessions in `/admin/users`. Every change is written to an append-only audit log. Passwords, password hashes, and authentication tokens are never displayed. Break-glass access to student data requires a documented reason and is audited.
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
- Backup/restore commands are implemented. Restore requires explicit confirmation, a named recovery database whose normalised URL differs from the production database, a different empty destination bucket, manifest/UUID validation, dump checksum verification, and object hash verification. Two hostnames could still point to the same database, so provider-side IAM/network separation is required; a production provider and recovery drill remain required before launch. Image metadata stripping and automated orphan-object cleanup remain follow-up controls.
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
- Deletion rights apply to minors and guardians through the in-app flow. A self-service export path is not implemented yet; the published privacy contact handles access requests.
- `/privacy` and `/terms` now describe the implemented account, document, MFA, HIBP, guardian-consent, backup, and AI-advisor behaviour instead of claiming accounts do not exist. Provider retention, transfer mechanisms, and final liability/governing-law terms are explicitly marked as operator decisions.
- The privacy notice and terms must still be reviewed for GDPR, UK GDPR, and applicable Uzbek data-protection requirements before launch. Legal review is an explicit launch gate; updating the pages is not a substitute for that review.

## Logging and monitoring

- Structured JSON logs use allowlisted fields and omit error messages, passwords, tokens, session cookies, document contents, AI prompts/answers containing personal data, user identifiers, and full IP addresses. Advisor events include only provider, model, outcome, latency, tool count, token counts, and estimated cost.
- IP addresses are hashed with `AUTH_SECRET` where abuse prevention requires them.
- Audit events record actor, action, entity, timestamp, and redacted metadata.
- Next.js request-error hooks and OpenTelemetry request spans are implemented. Header-derived span attributes are disabled and a processor strips query strings, fragments, token/credential keys, and exception details before export, so emailed links cannot leak through traces. Configure the external collector/backend to retain traces and logs and alert on 5xx responses, auth failures, rate-limit storage failures, file-processing failures, readiness failures, and missed backups; alert routing is platform-specific.
- Backup scripts write versioned artifacts to the private backup bucket, but a managed-provider restore drill has not been performed in this environment. Define RPO/RTO and complete the drill before production.

## Secrets and environments

- Secrets live in the hosting platform's encrypted environment store, never in git, client bundles, or build logs.
- `NEXT_PUBLIC_*` values are public by definition; no secret may use that prefix.
- `AUTH_SECRET` must be at least 32 characters. Rotating it invalidates HMAC-based rate-limit keys and signs users out only if it is also used for session hashing; sessions use unkeyed SHA-256 of high-entropy tokens.
- Separate development, preview, and production credentials. Rotate after any suspected exposure.
- `.github/workflows/ci.yml` and `.github/workflows/codeql.yml` run typecheck, lint, unit/integration tests, formatting, production build, container build, high-severity `npm audit` for both the full and production-only trees, Gitleaks secret scanning, CodeQL SAST, dependency review on pull requests, and a Trivy container scan with SARIF upload. `.github/dependabot.yml` proposes weekly npm and GitHub Actions updates. All action references are pinned to commit SHAs.
- Branch protection, a required-check policy, Dependabot enablement for private repositories, `GITLEAKS_LICENSE` for organisation repositories, Advanced Security features for dependency review/SARIF on private repositories, and a policy for unfixed Trivy findings are repository-host tasks listed in `docs/DEPLOYMENT.md`.
- `package.json` overrides the transitive `effect` dependency to `3.22.1` because no same-line Prisma release fixes the advisory; `npm audit --audit-level=high` and `npm audit --omit=dev --audit-level=high` both report zero vulnerabilities.

## Incident response

1. Contain: revoke sessions/keys, disable the affected path.
2. Assess: scope, data categories, affected users, legal notification duties.
3. Notify: affected users and authorities within required timelines; publish a plain-language post-mortem where appropriate.
4. Remediate: fix, add regression tests, rotate credentials, update this document.
5. Review: blameless retrospective and monitoring improvements.

## Security checklist

- [x] Argon2id password hashing with a documented baseline
- [x] Auth rate limits for sign-in, registration, reset, resend, guardian decisions, profile writes, password changes, and deletion
- [x] Sign-in throttling with generic denial messages and no permanent account lockout
- [x] Session hashing, idle and absolute expiry, revocation
- [x] Single-use hashed tokens with per-purpose expiry
- [x] Server-side session and role checks on every protected page and action
- [x] Database-backed admin capabilities with verified-email gating, grant/revoke controls, and Super Admin-only privilege changes
- [x] Reviewer-only catalog writes with same-origin checks on every action
- [x] Same-origin checks on mutations
- [x] Guardian consent flow tested end to end
- [x] Catalog records and facts require a source with a human verification date
- [x] Append-only catalog review history with staff attribution
- [x] Ownership tests for profile and session operations
- [x] Audit events for security-relevant actions
- [x] Account deletion with PII scrubbing
- [x] Breached-password check at registration, reset, and password change with bounded timeout/cache and fail-closed production behaviour
- [x] Opt-in TOTP MFA with single-use recovery codes, encrypted secrets, hashed challenges, rate limits, and audit events
- [ ] Mandatory MFA enforcement for staff and coverage on the Google sign-in path
- [ ] Email change with dual verification
- [x] Enforcing baseline Content-Security-Policy on every response
- [ ] Strict nonce-based CSP with a report-only rollout and violation collector
- [x] Private S3-compatible object operations, fail-closed malware scanning/quarantine, and authenticated owner-checked downloads
- [x] Advisor tool-scoping, ownership, timeout, and source-allowlisting tests
- [x] Server-side delimiting of student context and tool output; client link revalidation
- [ ] Dedicated adversarial prompt-injection evaluation set and live-provider red team
- [x] High-severity dependency audit and application checks in CI
- [x] Secret scanning and static analysis in CI
- [ ] Required branch-protection rules (repository host configuration)
- [ ] Backup restore drill on managed PostgreSQL and the production object-storage provider
- [x] Published security contact and disclosure policy from validated configuration
