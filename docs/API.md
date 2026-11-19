# API design (current + planned)

> **Status: No public JSON REST API.** The application is server-rendered and workspace mutations use owner-checked Next.js Server Actions. Catalog and workspace reads use server-side query functions. The private document upload/preview routes and the AI Advisor chat route are authenticated, same-origin Route Handlers, not public data APIs. `/api/health/live` and `/api/health/ready` are operational health checks. The REST tables later in this document remain future API contracts.

## Current surface

### Pages

| Route                                         | Method | Access                           | Notes                                                                                                                  |
| --------------------------------------------- | ------ | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `/`                                           | `GET`  | Public                           | Static marketing page                                                                                                  |
| `/privacy`, `/terms`                          | `GET`  | Public                           | Static trust documents                                                                                                 |
| `/data-sources`                               | `GET`  | Public                           | Static methodology and provenance page                                                                                 |
| `/universities`                               | `GET`  | Public                           | Catalog search; reads `q`, `country`, `degree`, `field`                                                                |
| `/universities/[slug]`                        | `GET`  | Public                           | University profile with sourced facts; `404` when unpublished                                                          |
| `/universities/[slug]/programs/[programSlug]` | `GET`  | Public                           | Program profile, requirements, tuition, deadlines                                                                      |
| `/scholarships`                               | `GET`  | Public                           | Scholarship search; reads `q`, `host_country`, `funding`, `degree`, `field`, `nationality`                             |
| `/scholarships/[slug]`                        | `GET`  | Public                           | Scholarship detail with sourced eligibility and deadlines                                                              |
| `/register`                                   | `GET`  | Public                           | Redirects signed-in users to `/dashboard`                                                                              |
| `/login`                                      | `GET`  | Public                           | Reads `?verified=1` and `?reset=1` to show a success notice                                                            |
| `/forgot-password`                            | `GET`  | Public                           | Request form                                                                                                           |
| `/reset-password?token=…`                     | `GET`  | Public                           | Renders confirmation; the token is consumed on POST                                                                    |
| `/verify-email?token=…`                       | `GET`  | Public                           | Renders confirmation; the token is consumed on POST                                                                    |
| `/verify-email?pending=1`                     | `GET`  | Signed in                        | "Check your inbox" state with a resend action                                                                          |
| `/guardian-consent/[token]`                   | `GET`  | Public (token is the capability) | Guardian review page; decision is submitted on POST                                                                    |
| `/guardian-consent/complete`                  | `GET`  | Public                           | Reads `?decision=approved` or `?decision=declined`                                                                     |
| `/dashboard`                                  | `GET`  | Session + workspace gate         | Overview, verification/consent status, next steps                                                                      |
| `/dashboard/advisor`                          | `GET`  | Session + workspace gate         | Private AI chat with source-linked answers and per-user history                                                        |
| `/dashboard/profile`                          | `GET`  | Session + verified + consent     | Study profile form                                                                                                     |
| `/dashboard/guardian-consent`                 | `GET`  | Session                          | Consent status and resend form                                                                                         |
| `/dashboard/settings`                         | `GET`  | Session                          | Password change, sessions, account deletion                                                                            |
| `/dashboard/favorites`                        | `GET`  | Workspace                        | The signed-in student's saved universities and scholarships                                                            |
| `/dashboard/applications`                     | `GET`  | Workspace                        | Nine-stage board with private-data summary metrics, deadline urgency, search, filters, sorting, and quick status moves |
| `/dashboard/applications/new`                 | `GET`  | Workspace                        | Add a currently listed university to the tracker                                                                       |
| `/dashboard/applications/[applicationId]`     | `GET`  | Workspace                        | Edit status, notes, deadline, progress; view history and manage linked documents                                       |
| `/dashboard/documents`                        | `GET`  | Workspace                        | Upload, categorize, rename, complete, preview, and delete private documents                                            |
| `/dashboard/documents/upload`                 | `POST` | Workspace + same-origin          | Validate and store a private document (PDF/JPEG/PNG/WebP, max 5 MiB)                                                   |
| `/dashboard/documents/[documentId]`           | `GET`  | Workspace + owner                | Preview supported file for its owner; `404` for another user's document                                                |
| `/dashboard/calendar`                         | `GET`  | Workspace                        | Month grid and upcoming application deadlines                                                                          |
| `/dashboard/notifications`                    | `GET`  | Workspace                        | In-app notifications and category preferences                                                                          |
| `/dashboard/review`                           | `GET`  | `REVIEWER` or `ADMIN`            | Review queue, all records, data-quality report                                                                         |
| `/dashboard/review/new?type=…`                | `GET`  | `REVIEWER` or `ADMIN`            | Import a university, program, or scholarship                                                                           |
| `/dashboard/review/[entityType]/[id]`         | `GET`  | `REVIEWER` or `ADMIN`            | Review one record, edit fields, add facts, decide                                                                      |
| `/dashboard/admin`                            | `GET`  | `REVIEWER` or `ADMIN`            | Operations overview and administration links                                                                           |
| `/dashboard/admin/users`                      | `GET`  | `ADMIN`                          | Search accounts, filter by role, paginate, change roles, revoke sessions                                               |
| `/robots.txt`, `/sitemap.xml`                 | `GET`  | Public                           | Generated crawler metadata; sitemap includes catalog entries                                                           |
| `/icon.svg`                                   | `GET`  | Public                           | Static asset                                                                                                           |

There is no public JSON `/api` route. The marketing search preview makes no network requests: `filterSampleUniversities` runs in the browser over eight local records. The public catalog filters are plain GET forms, so results are shareable URLs and work without client JavaScript.

The workspace upload/preview routes and `POST /api/advisor/chat` are authenticated exceptions to the no-public-REST statement above. Upload rejects missing/oversize `Content-Length`, cross-origin requests, unsupported MIME types, and mismatched file signatures, and is throttled per user and IP. Preview looks up the document by both its ID and owner ID and returns private `no-store` content with `nosniff`. The advisor route requires same-origin, a validated session, and an unlocked workspace; its provider, model, tools, and user scope are server-controlled. See [AI-ADVISOR.md](AI-ADVISOR.md).

### Catalog read functions

`src/lib/catalog/queries.ts` is the server-side read layer used by catalog pages and the reviewer workspace:

| Function                                        | Access | Returns                                                                                             |
| ----------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| `listUniversities(filters, userId?)`            | Public | Published universities matching search and filters, with caller-specific saved state when signed in |
| `getUniversityBySlug(slug, userId?)`            | Public | University, primary citation, published programs, and caller-specific saved state                   |
| `getProgramDetail(universitySlug, programSlug)` | Public | Program, requirements, tuition, deadlines, each with provenance                                     |
| `listScholarships(filters, userId?)`            | Public | Published scholarships matching search and filters, with caller-specific saved state when signed in |
| `getScholarshipBySlug(slug, userId?)`           | Public | Scholarship, requirements, deadlines with provenance, and caller-specific saved state               |
| `getCatalogOptions()`                           | Public | Available filter values (countries, fields, degree levels)                                          |
| `getProvenanceResponse(entityType, id)`         | Public | Validated provenance payload for one record                                                         |
| `getReviewQueue()`                              | Staff  | Records needing attention, oldest update first                                                      |
| `listReviewRecords()`                           | Staff  | Every catalog record, sorted by name                                                                |
| `getReviewRecord(entityType, id)`               | Staff  | Full record plus facts and primary source for editing                                               |
| `getEntityReviews(entityType, id)`              | Staff  | Append-only decision history for one record                                                         |
| `getDataQualityReport()`                        | Staff  | Status counts by entity type, coverage, stale records, citations without a verification date        |

Public functions return only `VERIFIED` and `NEEDS_REVIEW` records. Each detail response is validated against a Zod schema in `src/lib/catalog/provenance.ts`; a record that fails validation is withheld and logged rather than rendered partially. Filter parsing and href building live in `src/lib/catalog/filters.ts` and are unit-tested.

### Access rules

- **Public** pages render without a session. `/register` and `/login` redirect authenticated users to `/dashboard`.
- **Session** pages call `requireUser()`, which validates the session against the database and redirects to `/login` when absent.
- **Workspace** pages call `requireWorkspace()`, which requires a server-validated session and, for minors, recorded guardian consent. Email verification is optional and does not gate workspace access. `/dashboard/guardian-consent` stays reachable for students who need to manage consent.
- **Google OAuth** starts at `GET /api/auth/google/start`; new registrations use a same-origin `POST` to the same route with date of birth, terms acceptance, and (when required) guardian contact. The callback is `GET /api/auth/google/callback`. Google email must be verified; the authorization flow uses state and PKCE.
- **AI Advisor** reads and writes are scoped to the session user. The page uses `requireUser()` plus a workspace status check; chat posts to `/api/advisor/chat` with same-origin enforcement, and history actions call `requireWorkspace()` again. A conversation owned by another student is treated as absent.
- **Staff** pages call `requireRole(["REVIEWER", "ADMIN"])`, which redirects students to `/dashboard`. Every catalog mutation re-checks the role in the action as well as the page.
- Public catalog pages and detail routes render only `VERIFIED` and `NEEDS_REVIEW` records; `UNVERIFIED`, `EXPIRED`, and `ARCHIVED` return `404` on detail routes and are omitted from lists.
- `src/proxy.ts` redirects `/dashboard/*` requests that have no session cookie at all. It is a fast-path UX optimisation, not the authorization boundary: every page and action re-checks on the server.

## Server Actions

Workspace and catalog mutations use Server Actions rather than a JSON API; forms post `FormData`. Each action re-checks authorization and origin, validates its inputs, calls the owner-scoped service layer, and then revalidates or redirects. The binary upload is the one Route Handler mutation and validates same-origin, size, MIME, and file signature before storing bytes.

### Form state contract

```ts
type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>; // keyed by form field name
};
```

- `idle` is the initial state passed to `useActionState`.
- `error` sets `message` and optional `fieldErrors`; the form renders both inline and in an alert.
- `success` sets a confirmation `message`. Successful auth flows redirect instead of returning state.
- Rate-limit errors use a shared message ("Too many attempts. Try again in N minutes.") and never reveal which counter was hit.
- Registration validation and password-policy failures return field errors before any attempt counter is touched.

### Authentication actions (`src/app/(auth)/actions.ts`)

| Action                     | Form fields                                                                                | Result                                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `registerAction`           | `name`, `email`, `password`, `dateOfBirth`, `guardianName`, `guardianEmail`, `acceptTerms` | Creates the account and session, then redirects to `/dashboard?registered=1`. Duplicate email returns `email_taken` and sends an account-exists email. |
| `loginAction`              | `email`, `password`                                                                        | Creates a session and redirects to `/dashboard`. Failure returns the generic "Email or password is incorrect."                                         |
| `logoutAction`             | —                                                                                          | Revokes the current session, clears the cookie, redirects to `/`.                                                                                      |
| `forgotPasswordAction`     | `email`                                                                                    | Always returns the same success message; sends a reset link when the account exists.                                                                   |
| `resetPasswordAction`      | `token`, `password`, `confirmPassword`                                                     | Consumes the token, revokes all sessions, redirects to `/login?reset=1`.                                                                               |
| `verifyEmailAction`        | `token`                                                                                    | Consumes the token and redirects to `/login?verified=1`.                                                                                               |
| `resendVerificationAction` | —                                                                                          | Sends a new verification link for the signed-in user. Returns success if already verified.                                                             |
| `guardianDecisionAction`   | `token`, `decision` (`approve` or `decline`)                                               | Records the decision and redirects to `/guardian-consent/complete` with `decision=approved` or `decision=declined`.                                    |

### Dashboard actions (`src/app/dashboard/actions.ts`)

| Action                        | Auth requirement     | Form fields                                                                                                                                                                                           | Result                                                                                                       |
| ----------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `updateProfileAction`         | `requireWorkspace()` | `name`, `nationality`, `residenceCountry`, `currentDegree`, `targetDegree`, `fieldsOfStudy` (multi), `englishTest`, `englishScore`, `budgetAmount`, `budgetCurrency`, `guardianName`, `guardianEmail` | Saves the profile and revalidates `/dashboard` and `/dashboard/profile`.                                     |
| `changePasswordAction`        | `requireUser()`      | `currentPassword`, `password`, `confirmPassword`                                                                                                                                                      | Changes the password and revokes all other sessions.                                                         |
| `revokeSessionAction`         | `requireUser()`      | `sessionId`                                                                                                                                                                                           | Revokes one session owned by the caller.                                                                     |
| `revokeOtherSessionsAction`   | `requireUser()`      | —                                                                                                                                                                                                     | Revokes every session except the current one.                                                                |
| `resendGuardianConsentAction` | `requireUser()`      | `guardianName`, `guardianEmail` (optional; updates the stored contact when provided)                                                                                                                  | Issues a new 7-day guardian token and emails the guardian.                                                   |
| `deleteAccountAction`         | `requireUser()`      | `password`, `confirmation` (`DELETE`)                                                                                                                                                                 | Scrubs and soft-deletes the account, removes saved favorites, clears the cookie, redirects to `/?deleted=1`. |

### Catalog favorites (`src/app/catalog-actions.ts`)

| Action                     | Auth requirement     | Form fields                                                                                   | Result                                                                                                                                                                 |
| -------------------------- | -------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setCatalogFavoriteAction` | `requireWorkspace()` | `entityType` (`UNIVERSITY` or `SCHOLARSHIP`), `id`, `intent` (`save` or `remove`), `returnTo` | Saves/removes a favorite owned by the authenticated user and revalidates the catalog or favorites page. A record can only be newly saved while it is publicly visible. |

### Student workspace (`src/app/dashboard/workspace-actions.ts`)

All actions call `assertSameOrigin()` and `requireWorkspace()`. The service derives `userId` from the session and constrains every application, document, preference, and notification query by owner. Application statuses are limited to the nine values documented in the schema. Documents are linked only after both the application and document are found under the same owner.

| Action                              | Form fields                                                | Result                                                                                                                             |
| ----------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `createApplicationAction`           | `universityId`, `status`, `deadline`, `notes`              | Creates a unique student/university tracker row and initial status-history entry; only public catalog universities are selectable. |
| `updateApplicationAction`           | `applicationId`, `status`, `deadline`, `notes`, `progress` | Updates the owned tracker record; records a status event and preference-aware in-app update when status changes.                   |
| `setApplicationStatusAction`        | `applicationId`, `status`                                  | Board-level status move; preserves notes, deadline, and progress while recording history and a preference-aware update.            |
| `deleteApplicationAction`           | `applicationId`                                            | Deletes the owned application and its history; linked private documents remain in the library.                                     |
| `updateDocumentAction`              | `documentId`, `name`, `category`, `isComplete`             | Renames/re-categorizes/marks an owned document complete.                                                                           |
| `deleteDocumentAction`              | `documentId`                                               | Deletes owned document metadata and its private file bytes.                                                                        |
| `linkDocumentAction`                | `documentId`, `applicationId`, `linked`                    | Links or unlinks only when both records belong to the current student.                                                             |
| `saveNotificationPreferencesAction` | four category checkboxes                                   | Saves per-user notification preferences.                                                                                           |
| `markNotificationReadAction`        | `notificationId`                                           | Marks an owned persisted notification read.                                                                                        |

### AI advisor (`src/app/dashboard/advisor/actions.ts`)

All actions call `assertSameOrigin()`, `requireWorkspace()`, and Zod validation, then scope the service call to `session.user.id`. Conversation deletion and history clearing write redacted audit events; feedback does not.

| Action                            | Input                              | Result                                                |
| --------------------------------- | ---------------------------------- | ----------------------------------------------------- |
| `deleteAdvisorConversationAction` | `conversationId`                   | Hard-deletes one owned conversation and its messages. |
| `clearAdvisorHistoryAction`       | —                                  | Hard-deletes all owned conversations and messages.    |
| `setAdvisorMessageFeedbackAction` | `messageId`, `HELPFUL`/`UNHELPFUL` | Stores feedback on one owned assistant message.       |

### Cross-cutting rules for actions

- **CSRF:** session cookies are `SameSite=Lax`; every action calls `assertSameOrigin()`, comparing the `Origin` header with the forwarded/host header. Next.js also validates the Origin for Server Actions.
- **Validation:** every field is validated at its server boundary, including workspace enum/date/range checks and upload MIME/signature/size checks. Unknown values are ignored rather than trusted.
- **Rate limits:** database-backed fixed-window counters keyed by HMAC-hashed identifiers. See [SECURITY.md](SECURITY.md) for the full table.
- **Audit:** security-relevant actions write an `AuditEvent` with redacted metadata and a hashed IP.
- **Cookies:** only actions may set or clear cookies (`cookies().set/delete` is invalid during page rendering). The session cookie is `edubridge_session`.
- **Ownership:** session and profile mutations take the actor from the validated session, never from a form field. A resource that does not belong to the caller is treated as absent.
- **Redirects:** `redirect()` is called outside `try/catch` blocks, after the mutation succeeds.

### Catalog review actions (`src/app/dashboard/review/actions.ts`)

Every action calls `requireRole(["REVIEWER", "ADMIN"])` and `assertSameOrigin()`, parses input with `review-validation.ts`, writes a `CatalogReview` row and an `AuditEvent`, then revalidates the review and public catalog paths.

| Action                    | Form fields                                                                                                                                                                                                                                                                                                    | Result                                                                                                                                                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `importUniversityAction`  | `name`, `shortName`, `slug`, `city`, `countryCode`, `websiteUrl`, source fields (`sourceUrl`, `publisher`, `sourceTitle`, `accessedAt`, `verifiedAt`, `sourceNotes`), optional `facts` JSON, `publish`                                                                                                         | Creates the citation and university, and records the import decision and audit event                                                                                                                                     |
| `importProgramAction`     | `universityId`, `name`, `slug`, `degreeLevel`, `field`, `language`, `durationMonths`, `credits`, `startNote`, source fields (`sourceUrl`, `publisher`, `sourceTitle`, `accessedAt`, `verifiedAt`, `sourceNotes`), optional facts, `publish`                                                                    | Creates the citation and program, and records the import decision and audit event                                                                                                                                        |
| `importScholarshipAction` | `name`, `slug`, `providerName`, `providerUrl`, `hostCountryCode`, `fundingType`, `degreeLevels`, `nationalityScope`, `eligibleNationalities`, `fieldScope`, `fields`, `summary`, source fields (`sourceUrl`, `publisher`, `sourceTitle`, `accessedAt`, `verifiedAt`, `sourceNotes`), optional facts, `publish` | Creates the citation and scholarship, and records the import decision and audit event                                                                                                                                    |
| `updateRecordAction`      | Entity-specific fields, primary source fields, `publish`                                                                                                                                                                                                                                                       | Updates the record; returns it to `NEEDS_REVIEW` unless marked verified                                                                                                                                                  |
| `decisionAction`          | `entityType`, `id`, `decision`, `note`                                                                                                                                                                                                                                                                         | Records `APPROVE`, `REQUEST_CHANGES`, `RESTORE`, `EXPIRE`, or `ARCHIVE` with a validated status transition. Archive hides a catalog record without destroying its history. `FLAG_STALE` is recorded by the expiry sweep. |
| `addRequirementAction`    | `entityType`, `entityId`, `kind`, `summary`                                                                                                                                                                                                                                                                    | Adds a requirement against the record's primary source                                                                                                                                                                   |
| `addTuitionAction`        | `entityType`, `entityId`, `amount`, `currency`, `period`, `applicantGroup`, `note`                                                                                                                                                                                                                             | Adds a tuition fact to a program                                                                                                                                                                                         |
| `addDeadlineAction`       | `entityType`, `entityId`, `cycle`, `applicantGroup`, `opensOn`, `deadlineOn`, `opensMonthDay`, `deadlineMonthDay`, `note`                                                                                                                                                                                      | Adds a deadline fact                                                                                                                                                                                                     |
| `removeFactAction`        | `factType`, `factId`, `redirectTo`                                                                                                                                                                                                                                                                             | Removes one fact and revalidates the record                                                                                                                                                                              |
| `runSweepAction`          | —                                                                                                                                                                                                                                                                                                              | Moves `VERIFIED` records past `nextReviewAt` to `NEEDS_REVIEW`                                                                                                                                                           |

### Administrator actions (`src/app/dashboard/admin/actions.ts`)

Both actions call `assertSameOrigin()` and `requireRole(["ADMIN"])`, re-read the actor's database role, and return a small `FormState`. Role checks are never taken from form data.

| Action                     | Form fields      | Result                                                                                                                                                 |
| -------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `setUserRoleAction`        | `userId`, `role` | Sets `STUDENT`, `REVIEWER`, or `ADMIN`; rejects self-demotion and the last administrator; writes `admin.user_role_changed` and revalidates admin pages |
| `revokeUserSessionsAction` | `userId`         | Revokes another account's active sessions; self-revocation is rejected; writes `admin.user_sessions_revoked` and revalidates admin pages               |

## Conventions for the planned REST API

- **Base path:** `/api/v1`. Breaking changes require a new version; additive fields do not.
- **Transport:** HTTPS only. JSON request and response bodies (`application/json`), except document uploads (signed object-storage URLs). The current advisor returns complete JSON rather than an event stream.
- **Validation:** every body, query, and path parameter is parsed with a Zod schema at the boundary. Unknown keys are rejected for writes.
- **Authentication:** the same httpOnly, `Secure`, `SameSite=Lax` session cookie. Route handlers call a single `requireUser()` / `requireRole()` helper. Client-side checks are never authorization.
- **Errors:** stable envelope, no stack traces, no internal IDs that leak schema details.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields are invalid.",
    "fields": { "email": "Enter a valid email address." },
    "requestId": "req_01J..."
  }
}
```

- **Status codes:** `200` read/update, `201` create, `204` delete, `400` malformed, `401` unauthenticated, `403` authenticated but not allowed, `404` absent or not owned, `409` conflict, `422` semantic validation, `429` rate limited, `500` unexpected.
- **Not-found policy:** resources the caller does not own return `404`, not `403`, to avoid confirming existence.
- **Pagination:** cursor-based (`?cursor=...&limit=20`), maximum `limit=100`. Responses include `nextCursor`.
- **Idempotency:** write endpoints that can be retried accept `Idempotency-Key`; keys are stored for 24 hours.
- **Rate limits:** per user and per IP, with `429` and `Retry-After`. Suggested starting points: auth 10/min/IP, search 60/min/user, AI 20/hour/user, uploads 30/hour/user.
- **Caching:** public catalog reads may be cached and revalidated; anything under `/api/v1/me` is `Cache-Control: private, no-store`.
- **Request IDs:** generated at the edge, echoed in `X-Request-Id`, and attached to structured logs.

## Planned endpoints

### Authentication and account

> Milestone 2 implements these flows as Server Actions (above). A REST surface is only needed if a native client or third-party integration is added; it would reuse the same service layer.

| Method   | Route                          | Purpose                                                   |
| -------- | ------------------------------ | --------------------------------------------------------- |
| `POST`   | `/api/v1/auth/register`        | Create an account; sends verification email               |
| `POST`   | `/api/v1/auth/verify-email`    | Consume a single-use verification token                   |
| `POST`   | `/api/v1/auth/login`           | Start a session (generic errors; no app-level rate limit) |
| `POST`   | `/api/v1/auth/logout`          | Revoke the current session                                |
| `POST`   | `/api/v1/auth/forgot-password` | Send a reset link; always returns `202`                   |
| `POST`   | `/api/v1/auth/reset-password`  | Consume a hashed, expiring reset token                    |
| `GET`    | `/api/v1/me`                   | Current user, profile completeness, age status            |
| `PATCH`  | `/api/v1/me`                   | Update profile fields with Zod validation                 |
| `DELETE` | `/api/v1/me`                   | Request account deletion (re-authentication required)     |
| `GET`    | `/api/v1/me/export`            | Queued data export (future privacy tooling)               |

### Catalog

> Milestone 3 implements these reads as server-side functions (above). A REST surface would reuse the same query layer and response schemas.

| Method | Route                        | Purpose                                        |
| ------ | ---------------------------- | ---------------------------------------------- |
| `GET`  | `/api/v1/universities`       | Search/filter by country, degree, field, query |
| `GET`  | `/api/v1/universities/:slug` | Profile plus programs and cited facts          |
| `GET`  | `/api/v1/programs`           | Program search                                 |
| `GET`  | `/api/v1/programs/:id`       | Requirements with per-fact source and status   |
| `GET`  | `/api/v1/scholarships`       | Scholarship search/filter                      |
| `GET`  | `/api/v1/scholarships/:slug` | Coverage, criteria, deadline, sources          |
| `GET`  | `/api/v1/countries`          | Facet values with counts                       |

Public catalog responses expose only published records. Every verifiable field is returned with provenance:

```json
{
  "id": "prog_01J...",
  "university": { "name": "Example University", "countryCode": "DE" },
  "degreeLevel": "MASTER",
  "field": "Computer Science",
  "tuition": {
    "amountMinor": 1500000,
    "currency": "EUR",
    "period": "per year",
    "status": "VERIFIED",
    "source": {
      "url": "https://example.edu/tuition",
      "publisher": "Example University",
      "verifiedAt": "2026-10-02"
    }
  },
  "applicationDeadline": null,
  "deadlineNote": "Not published for the 2027 intake",
  "verification": "NEEDS_REVIEW"
}
```

A `null` fact with a note is a valid, honest answer. The API must never synthesize a value to avoid nulls.

### Student workspace

| Method           | Route                                | Purpose                                          |
| ---------------- | ------------------------------------ | ------------------------------------------------ |
| `GET`            | `/api/v1/applications`               | List the caller's applications                   |
| `POST`           | `/api/v1/applications`               | Start an application for a program               |
| `GET`            | `/api/v1/applications/:id`           | Application detail, documents, deadlines         |
| `PATCH`          | `/api/v1/applications/:id`           | Notes, priority, stage                           |
| `DELETE`         | `/api/v1/applications/:id`           | Remove an application                            |
| `GET`            | `/api/v1/applications/:id/history`   | Append-only stage history                        |
| `POST`           | `/api/v1/documents/upload-url`       | Validate metadata and return a signed PUT URL    |
| `POST`           | `/api/v1/documents/:id/complete`     | Confirm upload, enqueue scan                     |
| `GET`            | `/api/v1/documents/:id/download-url` | Short-lived signed GET URL after ownership check |
| `DELETE`         | `/api/v1/documents/:id`              | Soft delete and schedule object removal          |
| `GET`/`POST`     | `/api/v1/deadlines`                  | List/create deadlines                            |
| `PATCH`/`DELETE` | `/api/v1/deadlines/:id`              | Update/complete/delete                           |

Ownership checks are part of the service call, e.g. `application.userId === session.user.id`, not a UI filter.

### AI advisor

The implemented surface is the authenticated `POST /api/advisor/chat` Route Handler described in [AI-ADVISOR.md](AI-ADVISOR.md), not a public `/api/v1` stream. It accepts `{ conversationId?, message, regenerate? }`, enforces same-origin/session/workspace checks, and returns one `no-store` JSON answer with conversation metadata, the assistant message, validated citations, and estimated usage. A future `/api/v1/advisor/messages` streaming endpoint would reuse the same server-side orchestration, tools, sanitizer, and owner-scoped persistence.

Rules that already apply server-side:

- The provider, model, API key, base URL, tools, and user scope come from server state; the client never sends them.
- A static system prompt, delimited student context, and read-only tools ground the answer in catalog and owned-workspace data.
- Unverified external links are stripped and citations are generated from real tool sources, with verification dates when available.
- Provider failures return safe mapped messages and may include the recovery conversation ID; raw provider bodies are never returned.

### Admin and review

Admin endpoints live under `/api/v1/admin`, require `REVIEWER` or `ADMIN`, and write an audit event for every mutation: create/update/verify/expire records, manage sources, resolve reports, and redact data. Bulk imports require a source URL per row and a dry-run report.

## Server actions vs route handlers

- Use **Server Actions** for same-origin form mutations in the authenticated app (auth, profile, sessions, consent, deletion, catalog review) where progressive enhancement and revalidation matter. This is the Milestone 2–3 implementation.
- Use **route handlers** for public read APIs, auth callbacks, uploads, webhooks, and the authenticated advisor JSON endpoint.
- Both paths must call the same service layer and Zod schemas; no business logic in components.

## Webhooks and integrations

No third-party webhooks exist in Milestones 1–3. Planned: storage scan-completion callbacks (signed), email delivery events, and payment events only if a paid tier is introduced. Every webhook verifies a signature, rejects stale timestamps, and is idempotent by event ID.

## Testing contract

- Schema tests for every Zod input.
- Integration tests for registration, duplicate email, age gate, guardian consent, verification, login, password reset, profile ownership, session revocation, and account anonymisation, plus catalog visibility, provenance responses, reviewer decisions, audit history, the expiry sweep, workspace ownership, and advisor orchestration (60 tests currently pass).
- Route tests for authentication, ownership (`404` for other users' resources), validation, rate limits, and safe error mapping.
- Contract tests for provenance fields: a verified fact without a source fails the response schema.
- AI unit and integration tests use an injected provider and assert adapter mapping, citation/unknown handling, tool scoping, source allowlisting, regeneration, cost caps, and timeout behaviour. Live provider verification remains a deployment step.
