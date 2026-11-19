# Database design

> **Status: 500-university catalog implemented.** Identity, catalog, application workspace, private document metadata, notification, preference, university-discovery, comparison, study-note, and AI advisor tables exist in `prisma/schema.prisma` with applied migrations. Production managed-PostgreSQL verification remains a deployment step.

## Principles

1. **Facts are linked to evidence.** Every changeable fact about a university, program, or scholarship stores a source URL, publisher, verification date, and verification state.
2. **Unknown is a valid state.** Tuition, deadlines, and requirements may be absent. The UI omits them or says they are unknown rather than inferring or estimating.
3. **The student owns their data.** Ownership is enforced in the service layer on every read and write, not only in the UI.
4. **Minors get stricter handling.** Date of birth is stored as a date, never displayed publicly, and guardian consent is recorded before an under-18 workspace unlocks.
5. **History matters.** Security-relevant actions are append-only audit events; catalog decisions have their own append-only review history, and application stage changes will use the same pattern.
6. **Demo data never enters the production catalog.** Sample records live in code and are visibly labeled. A production seed contains only source-verified records.

## Implemented models (Milestones 2–3)

The authoritative source is [`prisma/schema.prisma`](../prisma/schema.prisma).

### Enumerations

| Enum                      | Values                                                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `Role`                    | `STUDENT`, `REVIEWER`, `ADMIN`                                                                                                           |
| `TokenPurpose`            | `EMAIL_VERIFICATION`, `PASSWORD_RESET`, `GUARDIAN_CONSENT`                                                                               |
| `ConsentType`             | `TERMS`, `PRIVACY`, `GUARDIAN`, `MARKETING`                                                                                              |
| `DegreeLevel`             | `BACHELOR`, `MASTER`, `PHD`, `DIPLOMA`, `CERTIFICATE`                                                                                    |
| `VerificationStatus`      | `VERIFIED`, `PARTIALLY_VERIFIED`, `INFORMATION_UNAVAILABLE`, `NEEDS_REVIEW`, `UNVERIFIED`, `EXPIRED`, `ARCHIVED`                         |
| `FieldVerificationStatus` | `VERIFIED`, `PARTIALLY_VERIFIED`, `NOT_VERIFIED`, `INFORMATION_UNAVAILABLE`                                                              |
| `FundingType`             | `FULLY_FUNDED`, `PARTIAL`, `TUITION_WAIVER`, `STIPEND`, `OTHER`                                                                          |
| `EligibilityScope`        | `ALL`, `LISTED`, `UNKNOWN`                                                                                                               |
| `RequirementKind`         | `ACADEMIC`, `ENGLISH_LANGUAGE`, `DOCUMENT`, `PORTFOLIO`, `WORK_EXPERIENCE`, `OTHER`                                                      |
| `CatalogEntityType`       | `UNIVERSITY`, `PROGRAM`, `SCHOLARSHIP`                                                                                                   |
| `ReviewDecision`          | `IMPORT`, `EDIT`, `APPROVE`, `REQUEST_CHANGES`, `EXPIRE`, `RESTORE`, `ARCHIVE`, `MARK_PARTIAL`, `MARK_UNAVAILABLE`, `FLAG_STALE`         |
| `ApplicationStatus`       | `INTERESTED`, `RESEARCHING`, `PREPARING_DOCUMENTS`, `READY_TO_APPLY`, `SUBMITTED`, `INTERVIEW`, `ACCEPTED`, `REJECTED`, `WAITLISTED`     |
| `StudentDocumentCategory` | `PASSPORT`, `ACADEMIC_TRANSCRIPT`, `IELTS_CERTIFICATE`, `SAT_SCORE_REPORT`, `RECOMMENDATION_LETTER`, `PERSONAL_STATEMENT`, `CV`, `OTHER` |
| `StudentNotificationType` | `DEADLINE`, `APPLICATION_STATUS`, `MISSING_DOCUMENT`, `SCHOLARSHIP_ANNOUNCEMENT`                                                         |
| `AdvisorMessageRole`      | `USER`, `ASSISTANT`                                                                                                                      |
| `AdvisorFeedback`         | `HELPFUL`, `UNHELPFUL`                                                                                                                   |
| `AdvisorRequestOutcome`   | `SUCCESS`, `PROVIDER_ERROR`, `TIMEOUT`, `RATE_LIMITED`, `BLOCKED`                                                                        |

### Identity and access

```prisma
model User {
  id              String    @id @default(cuid())
  email           String    @unique
  emailVerifiedAt DateTime?
  passwordHash    String?
  name            String
  role            Role      @default(STUDENT)
  dateOfBirth     DateTime? @db.Date
  locale          String    @default("en")
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  deletedAt       DateTime?

  profile      StudentProfile?
  sessions     Session[]
  tokens       AuthToken[]
  consents     ConsentRecord[]
  auditEvents  AuditEvent[]    @relation("ActorAuditEvents")
  universityFavorites UniversityFavorite[]
  scholarshipFavorites ScholarshipFavorite[]

  @@index([role])
  @@index([deletedAt])
}
```

- `email` is normalized to lowercase by validation before it reaches the database.
- `passwordHash` is nullable so future OAuth-only accounts do not need a password.
- `deletedAt` marks a soft-deleted, anonymised account. Authentication and session validation reject rows with `deletedAt` set.
- Account deletion clears saved university and scholarship favorites with the rest of the user's workspace data.
- `dateOfBirth` is stored as a date and used only for age rules.

```prisma
model Session {
  id         String    @id @default(cuid())
  userId     String
  tokenHash  String    @unique
  userAgent  String?
  ipHash     String?
  createdAt  DateTime  @default(now())
  lastUsedAt DateTime  @default(now())
  expiresAt  DateTime
  revokedAt  DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, revokedAt])
  @@index([expiresAt])
}
```

- The raw session token is never stored; `tokenHash` is a SHA-256 hash.
- `expiresAt` is the sliding idle expiry; the absolute 30-day cap is derived from `createdAt`.
- `ipHash` is an HMAC of the client IP using `AUTH_SECRET`; raw IPs are never persisted.

```prisma
model AuthToken {
  id        String      @id @default(cuid())
  userId    String
  purpose   TokenPurpose
  tokenHash String      @unique
  email     String?
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime    @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, purpose])
  @@index([expiresAt])
}
```

- One table covers email verification, password reset, and guardian consent.
- `email` stores the recipient for guardian tokens (which may differ from the student's address) and the reset target.
- Consumption uses a conditional update on `usedAt IS NULL` so a token cannot be redeemed twice.
- Issuing a new token for the same purpose marks older unused tokens as used.

```prisma
model ConsentRecord {
  id        String      @id @default(cuid())
  userId    String
  type      ConsentType
  version   String
  grantedAt DateTime    @default(now())
  revokedAt DateTime?
  ipHash    String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, type])
}
```

- Terms and privacy consent are recorded at registration with `POLICY_VERSION`.
- Guardian consent is recorded when a guardian approves, with the same policy version.
- The row is append-only; withdrawal is represented by `revokedAt` rather than deletion.

```prisma
model AuditEvent {
  id         String   @id @default(cuid())
  actorId    String?
  action     String
  entityType String
  entityId   String
  metadata   Json?
  ipHash     String?
  createdAt  DateTime @default(now())

  actor User? @relation("ActorAuditEvents", fields: [actorId], references: [id], onDelete: SetNull)

  @@index([entityType, entityId, createdAt])
  @@index([actorId, createdAt])
  @@index([action, createdAt])
}
```

Actions recorded in Milestone 2 include `auth.register`, `auth.login`, `auth.email_verified`, `auth.verification_resent`, `auth.password_reset_requested`, `auth.password_reset`, `auth.password_changed`, `guardian.consent_granted`, `guardian.consent_declined`, `guardian.consent_resent`, `profile.updated`, and `account.deleted`. Catalog and administration actions include `catalog.import`, `catalog.<decision>`, `catalog.flag_stale`, `admin.user_role_changed`, `admin.user_sessions_revoked`, and `admin.university_status_changed`. Metadata is redacted and never contains passwords, tokens, or document contents.

### Student profile

```prisma
model StudentProfile {
  id                     String       @id @default(cuid())
  userId                 String       @unique
  nationality            String?
  residenceCountry       String?
  currentDegree          DegreeLevel?
  targetDegree           DegreeLevel?
  fieldsOfStudy          String[]     @default([])
  englishTest            String?
  englishScore           String?
  budgetAmount           Int?
  budgetCurrency         String?
  guardianName           String?
  guardianEmail          String?
  guardianConsentAt      DateTime?
  guardianConsentVersion String?
  onboardingCompletedAt  DateTime?
  createdAt              DateTime     @default(now())
  updatedAt              DateTime     @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([nationality])
}
```

- `nationality` and `residenceCountry` are ISO 3166-1 alpha-2 codes validated against the application's country list.
- `fieldsOfStudy` is a string array validated against the shared study-field list; the form limits selection to six fields.
- `budgetAmount` is a whole-number annual budget in `budgetCurrency` (ISO 4217). It is intentionally **not** minor units because fractional budgets are not meaningful for planning. The original `budgetAmountMinor` column was renamed in migration `20261113000100_budget_amount`.
- `onboardingCompletedAt` is set when nationality, residence country, target degree, and at least one field of study are all present.
- A profile is created at registration and updated through the profile form. It is deleted when the account is deleted.

### Abuse prevention

```prisma
model RateLimitCounter {
  key         String   @id
  count       Int      @default(0)
  windowStart DateTime
  expiresAt   DateTime

  @@index([expiresAt])
}
```

- `key` is `scope:HMAC-SHA256(identifier)`, so the table never contains raw email addresses, IP addresses, or user IDs.
- The counter is updated with a single atomic upsert, making the limit effective across server instances.
- Expired rows can be deleted by a maintenance job; the application does not depend on their removal for correctness.

## Migrations

| Migration                                     | Purpose                                                                                       |
| --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `20261113000000_init`                         | Identity, sessions, tokens, consent, audit, student profile, rate limits                      |
| `20261113000100_budget_amount`                | Rename `StudentProfile.budgetAmountMinor` to `budgetAmount`                                   |
| `20261113000200_catalog`                      | Source-linked catalog: citations, universities, programs, scholarships, facts, review history |
| `20261113000300_catalog_fact_context`         | Add `Program.startNote` and `TuitionFact.applicantGroup`                                      |
| `20261116000000_review_decision_edit`         | Add `EDIT` to the `ReviewDecision` enum (`ALTER TYPE ... ADD VALUE`)                          |
| `20261116000100_catalog_favorites_archive`    | Add private university/scholarship favorites and the auditable `ARCHIVE` decision             |
| `20261116000200_student_workspace`            | Add applications, status history, private document metadata/links, notifications/preferences  |
| `20261116000300_google_oauth`                 | Add Google account linkage and OAuth-related identity fields                                  |
| `20261117000100_university_discovery_details` | Add verified university discovery detail fields and indexes                                   |
| `20261117000200_advisor`                      | Add advisor conversations, messages, usage ledger, and enums                                  |

`UniversityFavorite` and `ScholarshipFavorite` each use a unique `(userId, entityId)` pair, with cascading foreign keys to both the student and catalog record. This enforces one favorite per user/record and removes favorites when either side is physically deleted. Catalog records are archived rather than hard-deleted so their sources and append-only review history remain available.

Apply committed migrations with:

```bash
npm run db:migrate
```

Use `prisma migrate dev` only when authoring a new migration locally; use `prisma migrate deploy` in CI and production. No destructive migration ships without a backup and a documented rollback.

## Local development database

Production targets managed PostgreSQL 16+. Local development uses PGlite, a PostgreSQL build compiled to WebAssembly, served over the PostgreSQL wire protocol:

```bash
npm run db:start   # PGlite on 127.0.0.1:5432, data in .data/pglite
npm run db:migrate
```

Two PGlite-specific details matter:

1. **`&pgbouncer=true` in the local `DATABASE_URL`.** PGlite retains prepared statements across client reconnects. Without the parameter, Prisma's `s0`-style statement names collide after a dev-server restart. The parameter makes Prisma use simple queries. Remove it for managed PostgreSQL.
2. **Graceful shutdown.** Stop the server with `Ctrl+C`. Force-killing the process can corrupt `.data/pglite`. Recovery is to delete that directory, start the server again, and re-run migrations. The directory is git-ignored and contains only disposable local data.

Integration tests do not use the development database. `tests/integration/global-setup.ts` starts a fresh PGlite process on a random free port with `.data/pglite-test`, waits for its ready line, and runs `prisma migrate deploy` against it. A fresh process per run avoids prepared-statement collisions and keeps the suite repeatable.

## Source-linked catalog (Milestone 3)

Every published fact traces back to a `SourceCitation`. Records do not embed tuition, deadlines, or requirements as columns; those live in their own fact tables so each fact carries its own source and verification state. A record without a source cannot exist: `primarySourceId` is required and `onDelete: Restrict` prevents a citation from disappearing while a record still uses it.

### Provenance

```prisma
model SourceCitation {
  id          String    @id @default(cuid())
  url         String    @unique
  publisher   String
  title       String
  accessedAt  DateTime  @db.Date
  verifiedAt  DateTime? @db.Date
  notes       String?
  createdById String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  createdBy User? @relation("CitationAuthor", fields: [createdById], references: [id], onDelete: SetNull)

  universities        University[]         @relation("UniversityPrimarySource")
  programs            Program[]            @relation("ProgramPrimarySource")
  scholarships        Scholarship[]        @relation("ScholarshipPrimarySource")
  requirements        Requirement[]
  tuitionFacts        TuitionFact[]
  deadlineFacts       DeadlineFact[]
  rankedUniversities  University[]         @relation("UniversityRankingSource")
  fieldFacts          CatalogFieldFact[]

  @@index([verifiedAt])
}
```

- `url` is unique: re-importing the same official page updates one citation instead of duplicating it.
- `accessedAt` is when the page was read; `verifiedAt` is the date a human confirmed it. Only `verifiedAt` can support a `VERIFIED` record.
- `publisher` must be the institution, the scholarship provider, a named official body, or a named ranking/index publisher. Third-party publisher facts such as QS 2027 are stored as `PARTIALLY_VERIFIED`, never as `VERIFIED`.

### Universities and programs

```prisma
model University {
  id                  String             @id @default(cuid())
  slug                String             @unique
  name                String
  shortName           String?
  city                String
  countryCode         String
  websiteUrl          String?
  continent           String?
  institutionType     String?
  logoUrl             String?
  description         String?            @db.Text
  rankingOrganization String?
  rankingEdition      String?
  rankingPosition     Int?
  rankingDisplay      String?
  rankingTied         Boolean            @default(false)
  rankingIsRange      Boolean            @default(false)
  qsNid               Int?               @unique
  verificationStatus  VerificationStatus @default(UNVERIFIED)
  lastVerifiedAt      DateTime?          @db.Date
  nextReviewAt        DateTime?          @db.Date
  primarySourceId     String
  rankingSourceId     String?
  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt

  primarySource SourceCitation       @relation("UniversityPrimarySource", fields: [primarySourceId], references: [id], onDelete: Restrict)
  rankingSource SourceCitation?      @relation("UniversityRankingSource", fields: [rankingSourceId], references: [id], onDelete: SetNull)
  programs      Program[]
  favorites     UniversityFavorite[]
  applications  Application[]
  fieldFacts    CatalogFieldFact[]
  studyNotes    StudyNote[]

  @@index([countryCode, verificationStatus])
  @@index([verificationStatus, nextReviewAt])
  @@index([name])
  @@index([countryCode, rankingPosition])
}

model Program {
  id                 String             @id @default(cuid())
  universityId       String
  slug               String
  name               String
  degreeLevel        DegreeLevel
  field              String
  language           String?
  durationMonths     Int?
  credits            Int?
  startMonths        Int[]              @default([])
  startNote          String?
  verificationStatus VerificationStatus @default(UNVERIFIED)
  lastVerifiedAt     DateTime?          @db.Date
  nextReviewAt       DateTime?          @db.Date
  primarySourceId    String
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt

  university    University     @relation(fields: [universityId], references: [id], onDelete: Cascade)
  primarySource SourceCitation @relation("ProgramPrimarySource", fields: [primarySourceId], references: [id], onDelete: Restrict)
  requirements  Requirement[]
  tuitionFacts  TuitionFact[]
  deadlineFacts DeadlineFact[]

  @@unique([universityId, slug])
  @@index([degreeLevel, field])
  @@index([verificationStatus, nextReviewAt])
}
```

- `startMonths` holds calendar months only when the provider names them. `startNote` keeps the provider's wording (for example "Winter and summer semester") so a phrase is never converted into invented month numbers.
- Tuition, deadlines, and requirements are **not** columns on `Program`. A program with no tuition fact renders an explicit unknown state.
- `@@unique([universityId, slug])` keeps program URLs stable under their university.

### Global catalog provenance and student planning

Added in migrations `20261119000000_global_university_catalog` and `20261119010000_catalog_field_fact_university`:

```prisma
enum FieldVerificationStatus {
  VERIFIED
  PARTIALLY_VERIFIED
  NOT_VERIFIED
  INFORMATION_UNAVAILABLE
}

model CatalogFieldFact {
  id           String                  @id @default(cuid())
  entityType   CatalogEntityType
  entityId     String
  universityId String?
  fieldKey     String
  label        String
  value        String?                 @db.Text
  status       FieldVerificationStatus
  sourceId     String?
  sourceUrl    String?
  sourceTitle  String?
  verifiedAt   DateTime?               @db.Date
  academicYear String?
  intake       String?
  currency     String?
  unit         String?
  note         String?                 @db.Text
  createdAt    DateTime                @default(now())
  updatedAt    DateTime                @updatedAt

  source     SourceCitation? @relation(fields: [sourceId], references: [id], onDelete: SetNull)
  university University?     @relation(fields: [universityId], references: [id], onDelete: SetNull)

  @@unique([entityType, entityId, fieldKey])
  @@index([entityType, status])
  @@index([entityId])
  @@index([universityId])
}

model UniversityComparison {
  userId        String   @id
  universityIds String[] @default([])
  updatedAt     DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model StudyNote {
  id            String   @id @default(cuid())
  userId        String
  title         String
  body          String   @db.Text
  universityId  String?
  programId     String?
  scholarshipId String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  university  University?  @relation(fields: [universityId], references: [id], onDelete: SetNull)
  program     Program?     @relation(fields: [programId], references: [id], onDelete: SetNull)
  scholarship Scholarship? @relation(fields: [scholarshipId], references: [id], onDelete: SetNull)

  @@index([userId, updatedAt])
  @@index([universityId])
}
```

- `CatalogFieldFact` is one row per exposed field per catalog entity. The field-level status is independent of the record-level review status.
- `value: null` is paired with `INFORMATION_UNAVAILABLE`, so an absent fact is an explicit state rather than a missing row.
- `qsNid` is unique and allows the importer to update the same QS institution idempotently.
- The four-item maximum on `UniversityComparison.universityIds` is enforced in the service layer (`src/lib/catalog/comparison.ts`), not only in the UI, and unavailable university ids are rejected.
- `StudyNote` rows are private to their owner and cascade with the user account.

### Scholarships

```prisma
model Scholarship {
  id                    String             @id @default(cuid())
  slug                  String             @unique
  name                  String
  providerName          String
  providerUrl           String
  hostCountryCode       String?
  fundingType           FundingType
  degreeLevels          DegreeLevel[]
  nationalityScope      EligibilityScope   @default(UNKNOWN)
  eligibleNationalities String[]           @default([])
  fieldScope            EligibilityScope   @default(UNKNOWN)
  fields                String[]           @default([])
  summary               String
  verificationStatus    VerificationStatus @default(UNVERIFIED)
  lastVerifiedAt        DateTime?          @db.Date
  nextReviewAt          DateTime?          @db.Date
  primarySourceId       String
  createdAt             DateTime           @default(now())
  updatedAt             DateTime           @updatedAt

  primarySource SourceCitation @relation("ScholarshipPrimarySource", fields: [primarySourceId], references: [id], onDelete: Restrict)
  requirements  Requirement[]
  deadlineFacts DeadlineFact[]

  @@index([hostCountryCode, verificationStatus])
  @@index([fundingType, verificationStatus])
  @@index([verificationStatus, nextReviewAt])
}
```

- `nationalityScope` and `fieldScope` distinguish "open to everyone" (`ALL`) from "a list is published" (`LISTED`) from "not documented" (`UNKNOWN`). An empty array alone cannot tell those apart, and the UI must not imply eligibility it cannot prove.
- `summary` paraphrases the provider's own description; amounts and eligibility rules stay in `DeadlineFact`/`Requirement` with their source.

### Facts

```prisma
model Requirement {
  id                 String             @id @default(cuid())
  programId          String?
  scholarshipId      String?
  kind               RequirementKind
  summary            String
  verificationStatus VerificationStatus @default(VERIFIED)
  sourceId           String
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt

  program     Program?       @relation(fields: [programId], references: [id], onDelete: Cascade)
  scholarship Scholarship?   @relation(fields: [scholarshipId], references: [id], onDelete: Cascade)
  source      SourceCitation @relation(fields: [sourceId], references: [id], onDelete: Restrict)

  @@index([programId])
  @@index([scholarshipId])
}

model TuitionFact {
  id                 String             @id @default(cuid())
  programId          String
  amountMinor        Int
  currency           String
  period             String
  applicantGroup     String?
  note               String?
  verificationStatus VerificationStatus @default(VERIFIED)
  sourceId           String
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt

  program Program        @relation(fields: [programId], references: [id], onDelete: Cascade)
  source  SourceCitation @relation(fields: [sourceId], references: [id], onDelete: Restrict)

  @@index([programId])
}

model DeadlineFact {
  id                 String             @id @default(cuid())
  programId          String?
  scholarshipId      String?
  cycle              String
  applicantGroup     String?
  opensOn            DateTime?          @db.Date
  deadlineOn         DateTime?          @db.Date
  opensMonthDay      String?
  deadlineMonthDay   String?
  note               String?
  verificationStatus VerificationStatus @default(VERIFIED)
  sourceId           String
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt

  program     Program?       @relation(fields: [programId], references: [id], onDelete: Cascade)
  scholarship Scholarship?   @relation(fields: [scholarshipId], references: [id], onDelete: Cascade)
  source      SourceCitation @relation(fields: [sourceId], references: [id], onDelete: Restrict)

  @@index([programId])
  @@index([scholarshipId])
  @@index([deadlineOn])
}
```

- `Requirement` and `DeadlineFact` are polymorphic across programs and scholarships; the service layer enforces that exactly one parent is set.
- `TuitionFact.amountMinor` is integer minor units plus an ISO 4217 `currency`. `applicantGroup` records who the amount applies to, because tuition usually differs by nationality and campus; an amount without its group is not publishable.
- `opensMonthDay`/`deadlineMonthDay` store `MM-DD` for pages that publish "1 February – 31 May" without a year. They are never turned into a guessed calendar date.
- Fact rows default to `VERIFIED` because they can only be created against an existing citation; the review service still checks the citation has a `verifiedAt` before a record is approved.

### Review history

```prisma
model CatalogReview {
  id         String             @id @default(cuid())
  entityType CatalogEntityType
  entityId   String
  decision   ReviewDecision
  fromStatus VerificationStatus?
  toStatus   VerificationStatus
  note       String?
  reviewerId String?
  createdAt  DateTime           @default(now())

  reviewer User? @relation("CatalogReviews", fields: [reviewerId], references: [id], onDelete: SetNull)

  @@index([entityType, entityId, createdAt])
  @@index([reviewerId, createdAt])
  @@index([decision, createdAt])
}
```

- Append-only. Every import, edit, approval, change request, expiry, restore, and stale flag writes a row.
- Kept separate from `AuditEvent` so the review queue and data-quality report can query decisions without parsing JSON metadata.
- `reviewerId` becomes `NULL` if the staff account is deleted; the decision and its note are retained.
- The same mutation also writes an `AuditEvent` (`catalog.import`, `catalog.edit`, `catalog.approve`, `catalog.request_changes`, `catalog.expire`, `catalog.restore`, `catalog.sweep`).

Rules enforced by the review service and UI:

- A record cannot be marked `VERIFIED` without a primary source whose `verifiedAt` is set.
- `APPROVE` sets `lastVerifiedAt` from the source and schedules `nextReviewAt` 180 days out. `RESTORE` returns a record to `NEEDS_REVIEW`, never straight to `VERIFIED`.
- When a source changes or a review window passes, dependent records move to `NEEDS_REVIEW` and stay visible with a warning banner. Nothing is silently retained as verified and nothing is deleted.
- `UNVERIFIED`, `EXPIRED`, and `ARCHIVED` records are hidden from public lists and detail pages.

## Student workspace models (Milestone 4)

- `Application` belongs to one user and one currently available university; `(userId, universityId)` is unique. It stores one of nine lifecycle statuses, notes, a calendar deadline, progress from 0 to 100, and timestamps.
- `ApplicationStatusEvent` stores append-only status transitions. The current status is updated on the application row while prior states remain queryable for activity/history.
- `StudentDocument` stores owner, display name, category, private storage key, allowlisted MIME type, size, and completion state. The database enforces a positive size no larger than 5 MiB. File bytes are in `.data/private-documents`, outside `public`; the storage key is a server-generated UUID and is not an URL.
- `ApplicationDocument` links a student's owned document to an owned application. The service verifies both ownerships before creating the link.
- `NotificationPreference` has separate opt-ins for deadline, application status, missing document, and scholarship announcement updates.
- `StudentNotification` persists application status updates. Deadline and missing-document reminders are derived from current owned records; recent catalog scholarship additions form the announcement feed. All notification reads filter by the student's owner ID.

Uploads accept only PDF, JPEG, PNG, and WebP files up to 5 MiB; the server validates both declared MIME type and file signature. Previews are served by an authenticated, owner-scoped route with `no-store` and `nosniff` headers. The application never executes uploaded bytes. Local filesystem storage is not suitable for ephemeral/serverless or multi-instance production: durable private object storage, malware scanning, backup/restore, and a production retention plan remain deployment requirements.

## AI advisor models (Milestone 8)

- `AdvisorConversation` is owned by one `User`, has a non-null generated title, and is indexed by `(userId, updatedAt)`. Messages and usage rows cascade from it.
- `AdvisorMessage` stores `USER` or `ASSISTANT` content, the responding model, server-validated `citations` JSON, tool names, optional feedback with timestamp, and a creation time. It is indexed by `(conversationId, createdAt)` so history reads stay ordered and bounded.
- `AdvisorUsage` is a metadata-only ledger: owner, optional conversation, provider/model, token counts, estimated micro-USD cost, outcome, and timestamp. It contains no prompt, answer, document name, or email. `conversationId` uses `onDelete: SetNull` so aggregate cost history survives conversation deletion without retaining content.
- Deleting a conversation or clearing history hard-deletes conversations and messages. Account deletion cascades the same content. Only deletion and clear-history actions write redacted audit events; ordinary chat messages are not mirrored into `AuditEvent`.
- Provider keys are environment-only and never stored in these tables. Conversation retention is disclosed in the UI and privacy documentation; provider training/retention settings remain a deployment review item.

## Indexing and integrity notes

- Public catalog lists filter on `(verificationStatus, nextReviewAt)` and `(countryCode, verificationStatus)`; both are indexed on the record tables so visibility and expiry queries stay cheap as the catalog grows.
- `SourceCitation.url` is unique so repeated imports of the same page converge on one citation. `primarySourceId` uses `onDelete: Restrict`, so a citation cannot be removed while a record depends on it.
- Cursor pagination will use `(createdAt, id)` composite indexes on high-volume lists.
- Slugs are unique per parent and treated as stable public identifiers.
- `Application(userId, universityId)` is unique so a student cannot duplicate a university application.
- `AdvisorConversation(userId, updatedAt)` backs history lists and `AdvisorMessage(conversationId, createdAt)` backs ordered message loads; `AdvisorUsage(userId, createdAt)` and `(createdAt)` support per-user and global daily cost checks.
- Cascades remove a student's workspace data on account deletion; the service removes private object bytes before committing the database deletion. Audit events retain a null actor and redacted metadata. Catalog records cascade from their parent program but never from a source.
- Monetary values are integer minor units plus ISO currency in the catalog. The student budget is a whole-unit integer because it is a planning range, not a transaction.
- Dates are stored in UTC; catalog `@db.Date` fields are calendar dates with no time component. The UI formats them for display.
- Full-text search starts with PostgreSQL `ILIKE` over name, city, provider, and summary. A dedicated search service is not justified at this scale.

## Deletion and export

- Account deletion is an immediate soft delete: sessions are revoked, auth tokens, favorites, applications, documents, notifications, preferences, and the student profile are deleted, private document bytes are removed, and the user row is anonymised (`deleted+<id>@edubridge.invalid`, name `Deleted account`, password hash and date of birth cleared).
- The anonymised user row and its audit events are retained for security and abuse prevention. No profile content, email address, name, or date of birth remains.
- Advisor conversations and messages are hard-deleted by the student's delete/clear actions and by account deletion; the usage ledger keeps only metadata. A scheduled hard-delete window and a machine-readable export (JSON plus document list) remain planned for a later milestone to satisfy access requests.
