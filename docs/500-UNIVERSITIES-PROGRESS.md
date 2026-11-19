# 500-university catalog — milestone progress

## Milestone 1 — architecture and plan

**Status:** Complete

**Completed work**

- Mapped the full Prisma schema, catalog read layer, public/dashboard pages, advisor tools, workspace, seed/import scripts, UI system, tests and migration history.
- Confirmed the app uses Next.js 16.4.6 and read the bundled agent/data-mutation/image/version-16 guides in `node_modules/next/dist/docs/`.
- Confirmed QS 2027 is published and that the public QS Algolia university index exposes `wur_rank` matching the published top-30, including `=2` ties.
- Wrote the executable 10-milestone plan.

**Modified files**

- `docs/500-UNIVERSITIES-PLAN.md` (new)
- `docs/500-UNIVERSITIES-PROGRESS.md` (new)

**Verified record count**

- Database still contains the original four hand-verified seed universities; no import performed yet.

**Missing information**

- Official websites, programme details and QS profile enrichment are not yet cached because the first research run timed out near 400/500 before writing output.

**Tests run**

- None in this milestone (research/documentation only).

**Fixes**

- None needed yet.

## Milestone 2 — research dataset

**Status:** Complete

**Completed work**

- Generated `data/qs-2027-universities.json` from the public QS 2027 university and programme indexes.
- Selected exactly 500 distinct universities using QS `wur_rank`, preserving tie markers such as `=2` and range strings such as `951-1000`.
- Resolved 345 official websites through Wikidata `P856` with a confident label match; 155 have no verified website value.
- Cached QS programme samples for 294 universities; 206 have no sampled programmes in the research dataset.
- Added bounded concurrency, cache/checkpointing and retry behaviour to the research script after an interrupted first run.

**Modified files**

- `scripts/research-qs-universities.mjs`
- `data/qs-2027-universities.json` (generated)
- `data/.cache/qs-2027/` (generated cache)

**Verified record count**

- 500 dataset records, 500 unique names, 500 unique QS node ids.
- Country coverage: US 81, GB 53, CA 20, DE 34, FR 20, NL 13, CH 9, SE 8, FI 7, NO 3, DK 5, IT 17, ES 17, AU 31, NZ 8, JP 16, KR 18, CN 41, HK 7, SG 4, MY 15, TW 13, SA 6, AE 11, QA 2, TR 7, KZ 3, IN 16, BR 5, CL 4, ZA 6.
- Enrichment: 345 with official website, 155 without; 294 with programmes, 206 without.

**Missing information**

- QS does not publish IELTS/TOEFL/SAT minima, application deadlines, intake months, founded year, contact details, individual scholarship awards, or guaranteed English-taught status.
- 155 official websites remain unavailable because no confident Wikidata `P856` claim was found.
- Live AI provider verification remains external: no `AI_API_KEY` is configured.

**Tests run**

- `node scripts/research-qs-universities.mjs` completed successfully, including a resumed run after the earlier timeout.

**Fixes**

- Removed failed cache entries before the final website retry so unresolved names could be retried.
- Kept QS source URLs and rank strings verbatim; no rank was inferred for unranked institutions.

## Milestone 3 — schema, migration and import pipeline

**Status:** Complete

**Completed work**

- Extended Prisma with record statuses `PARTIALLY_VERIFIED` and `INFORMATION_UNAVAILABLE`, field-level `FieldVerificationStatus`, generic `CatalogFieldFact`, `UniversityComparison`, `StudyNote`, and ranking/type/logo/description fields on `University`.
- Hand-authored two PostgreSQL migrations: the main catalog extension and a follow-up aligning `CatalogFieldFact.universityId` with the typed university back-relation.
- Built an offline, idempotent importer that validates exactly 500 records, upserts citations/universities/programmes/field facts, preserves hand-verified records, writes review/audit records and emits a JSON report.
- Added a verification script and package commands for import and database verification.
- Successfully applied migrations to the running PGlite development database and imported the full dataset.

**Modified files**

- `prisma/schema.prisma`
- `prisma/migrations/20261119000000_global_university_catalog/migration.sql`
- `prisma/migrations/20261119010000_catalog_field_fact_university/migration.sql`
- `scripts/import-qs-universities.mts`
- `scripts/verify-qs-import.mts`
- `scripts/cleanup-failed-qs-import.mts`
- `package.json`
- `src/lib/catalog/constants.ts`
- `src/lib/catalog/format.ts`
- `src/lib/catalog/provenance.ts`
- `src/lib/catalog/queries.ts`
- `src/lib/catalog/discovery-queries.ts`
- `src/app/(marketing)/universities/[slug]/page.tsx`
- `src/app/dashboard/universities/[slug]/page.tsx`

**Verified record count**

- Database universities: **500** (exactly).
- Status counts: 496 `PARTIALLY_VERIFIED`, 4 `VERIFIED`; no duplicate names.
- Programmes: 2,232 (4 hand-verified + 2,228 imported).
- Field facts: 32,740.
- Import report: 500 dataset records, 500 updated universities, 4 kept hand-verified records, 2,228 created programmes, 3,073 citations, 0 errors, 620 warnings.
- All 500 QS node ids and exact rank strings match the research dataset.
- Four hand-verified seed universities remain `VERIFIED`: TU Munich, University of Amsterdam, TU Delft, The University of Manchester.

**Missing information**

- 155 universities have no official website value; the UI must render that explicitly rather than linking a guessed domain.
- 206 universities have no QS programme sample; their programme lists will be empty or hand-verified.
- Unavailable admission/deadline/language/contact fields are stored as `INFORMATION_UNAVAILABLE` field facts.

**Tests run**

- `npx prisma format`, `npx prisma validate`, `npx prisma generate`.
- `npm run typecheck` (passed after nullable website/status count fixes).
- `npm run db:migrate`.
- `npm run db:import:qs`.
- `npm run db:verify:qs`.
- A one-off recovery script removed a duplicate Manchester record created by the first failed import.

**Fixes**

- Made `University.websiteUrl` nullable throughout query DTOs and detail pages, with conditional rendering for unavailable websites.
- Added the two new statuses to the review dashboard count map.
- Added the missing `CatalogFieldFact.universityId` migration after the first import exposed a schema/migration mismatch.
- Added legacy slug matching (`the-university-of-manchester` → `university-of-manchester`) so the hand-verified seed and QS record do not duplicate.
- Fixed a local PGlite port conflict by reusing the already-running database instead of starting a second server.

## Milestone 4 — discovery and detail UI

**Status:** Complete

**Completed work**

- Extracted pure QS import helpers into `src/lib/catalog/qs-import-mapping.ts` and added 12 unit tests for dataset validation, slug aliases, degree mapping, field classification, duration/fee parsing and URL/slug helpers.
- Rendered QS 2027 rank, continent, institution type, logo, description and official-website availability on public and dashboard university cards and detail pages.
- Added a reusable `FieldFactPanel` / `FieldStatusBadge` that shows each fact's value, its field-level verification status, source, verification date, academic year, intake and currency/unit, with an explicit unavailable state.
- Added combined continent and institution-type filters to both the public catalog and the dashboard discovery stack, wired through URL parameters, forms, query predicates and pagination links.
- Kept 12-item pagination in both stacks; dashboard pagination still clamps out-of-range pages.

**Modified files**

- `src/lib/catalog/qs-import-mapping.ts` (new)
- `tests/unit/qs-import-mapping.test.ts` (new)
- `scripts/import-qs-universities.mts`
- `src/lib/catalog/constants.ts`
- `src/lib/catalog/filters.ts`
- `src/lib/catalog/queries.ts`
- `src/lib/catalog/discovery-filters.ts`
- `src/lib/catalog/discovery-queries.ts`
- `src/components/catalog/cards.tsx`
- `src/components/catalog/filters.tsx`
- `src/components/catalog/verification.tsx`
- `src/app/(marketing)/universities/[slug]/page.tsx`
- `src/app/dashboard/universities/page.tsx`
- `src/app/dashboard/universities/[slug]/page.tsx`
- `tests/unit/catalog-filters.test.ts`
- `tests/unit/university-discovery-filters.test.ts`

**Verified record count**

- No database rows changed; the catalog remains at 500 universities from Milestone 3.

**Missing information**

- 155 universities have no official website value; both cards and detail pages now render an explicit unavailable state instead of a guessed link.
- 206 universities have no QS programme sample; those profiles say no programme records are published.
- Field-level facts for admissions/test/contact data are `INFORMATION_UNAVAILABLE` and render as such.

**Tests run**

- `npm run typecheck` — passed.
- `npm test` — 220 passed across 31 files (up from 200/30 after adding QS mapping tests).
- `npm run format` — applied.

**Fixes**

- Removed the last unused importer types and replaced the inline legacy-slug regex with the tested helper.
- Fixed a stale `postmaster.pid` in the local PGlite data directory; the WASM store still refuses to reopen cleanly after an unclean shutdown, so database-backed verification relies on the isolated integration-test database instead.

## Milestone 5 — student workspace

**Status:** Complete

**Completed work**

- Wired favourites and saved scholarships to the enlarged catalog; both remain private to the signed-in student.
- Added a private four-item university comparison shortlist. The cap and visible-record check are enforced in `src/lib/catalog/comparison.ts`, not only in the UI.
- Added add/remove/set comparison actions, detail-page comparison buttons, a dedicated `/dashboard/comparison` page, and a confirmation message when the shortlist is full.
- Added private research notes with owner-scoped create/list/read/update/delete. Optional university, programme and scholarship links must resolve to records visible in the public catalog.
- Added `/dashboard/notes` and `/dashboard/notes/[id]`, dashboard navigation entries, and detail-page note links. Applications and deadlines remain DB-backed and user-scoped.

**Modified files**

- `src/lib/catalog/comparison.ts` (new)
- `src/lib/catalog/notes.ts` (new)
- `src/app/dashboard/comparison/actions.ts` (new)
- `src/app/dashboard/comparison/page.tsx` (new)
- `src/app/dashboard/notes/actions.ts` (new)
- `src/app/dashboard/notes/page.tsx` (new)
- `src/app/dashboard/notes/[id]/page.tsx` (new)
- `src/components/catalog/comparison-button.tsx` (new)
- `src/components/dashboard/dashboard-nav.tsx`
- `src/lib/catalog/favorites.ts`
- `src/app/dashboard/universities/[slug]/page.tsx`
- `src/app/(marketing)/universities/[slug]/page.tsx`
- `tests/integration/comparison-notes.test.ts` (new)

**Verified record count**

- No catalog rows changed; the database remains at **500** universities.

**Missing information**

- Comparison and notes display only sourced catalog values; unavailable tuition, deadline or website fields still render as unavailable.
- Browser E2E was not run because Playwright is not installed in this environment.

**Tests run**

- `tests/integration/comparison-notes.test.ts` — 11 tests covering the four-item cap, visible-only ids, owner scoping, hidden links, and update/delete ownership.
- Full suites at this stage: `npm test` and `npm run test:integration` passed.

**Fixes**

- Rejected non-visible university ids in both comparison and note-link services so hidden records cannot be referenced through a crafted action.

## Milestone 6 — AI advisor grounding

**Status:** Complete

**Completed work**

- Added a pure `classifyUniversity` helper that uses only QS 2027 rank bands, catalog tuition, degree/field facts and the saved student budget.
- Added the 11th read-only advisor tool, `classify_shortlist`. It reads real catalog rows, falls back to the student's saved universities, returns source URLs, and rejects injected `userId` arguments through strict Zod schemas.
- Preserved exact QS rank strings, including `=2` ties and ranges such as `601-650`, in the explanation text.
- Added a mandatory disclosure that Reach / Target / Likely are planning estimates, not admission predictions or guarantees. The system prompt, tool response and advisor page all repeat it.
- Updated advisor documentation for the enlarged catalog and the new grounding rules.

**Modified files**

- `src/lib/advisor/classification.ts` (new)
- `src/lib/advisor/tools.ts`
- `src/lib/advisor/prompt.ts`
- `src/app/dashboard/advisor/page.tsx`
- `tests/unit/advisor-classification.test.ts` (new)
- `tests/unit/advisor-tools.test.ts`
- `tests/integration/catalog-extensions.test.ts` (new)
- `docs/AI-ADVISOR.md`

**Verified record count**

- No catalog rows changed; the database remains at **500** universities.

**Missing information**

- Live AI provider/model quality, latency, billing and provider retention settings remain external: no real `AI_API_KEY` is configured.

**Tests run**

- `tests/unit/advisor-classification.test.ts` — 7 tests, including exact tie/range preservation and the unranked case.
- `tests/unit/advisor-tools.test.ts` — tool-spec assertion for `classify_shortlist` and its planning-estimate description.
- `tests/integration/catalog-extensions.test.ts` — 4 DB-backed classification tests.
- Full `npm test` and `npm run test:integration` suites passed.

**Fixes**

- An integration test found that the reason used the numeric `rankingPosition` and dropped `=`/range strings. The classifier now uses `rankingDisplay` verbatim.
- Corrected an incorrect unit expectation for the unranked case: it still has a comparable budget, so its `missingFacts` list is empty.

## Milestone 7 — admin management and review decisions

**Status:** Complete

**Completed work**

- Added `MARK_PARTIAL` and `MARK_UNAVAILABLE` review decisions with a dedicated PostgreSQL migration and Prisma enum values.
- Allowed nullable university websites in reviewer validation and forms, so a missing official website is an explicit unavailable state rather than a fake URL.
- Fixed the public-link condition so `PARTIALLY_VERIFIED` stays visible while `INFORMATION_UNAVAILABLE` is hidden.
- Updated review queue statistics and data-quality counts for the new statuses.
- Added an `ADMIN`-only `/dashboard/admin/universities` page with text search, status filtering, pagination and an audited status override control. Role checks are re-read from the database in the action layer.

**Modified files**

- `prisma/schema.prisma`
- `prisma/migrations/20261119020000_review_decision_partial_unavailable/migration.sql` (new)
- `src/lib/catalog/review-service.ts`
- `src/lib/catalog/review-validation.ts`
- `src/app/dashboard/review/actions.ts`
- `src/app/dashboard/review/page.tsx`
- `src/lib/catalog/queries.ts`
- `src/lib/admin/universities.ts` (new)
- `src/app/dashboard/admin/actions.ts`
- `src/app/dashboard/admin/universities/page.tsx` (new)
- `src/components/admin/university-status-control.tsx` (new)
- `tests/integration/catalog-extensions.test.ts`
- `docs/ARCHITECTURE.md`
- `docs/DATABASE.md`

**Verified record count**

- No catalog rows changed; the database remains at **500** universities. The new migration applied cleanly to a fresh integration database.

**Missing information**

- Production managed-PostgreSQL verification, browser E2E, and Git commit history remain external to this environment.

**Tests run**

- `tests/integration/catalog-extensions.test.ts` — 2 explicit-decision tests and 2 admin-management tests.
- Full `npm test` and `npm run test:integration` suites passed.

**Fixes**

- Applied the review-decision migration to the integration database before rerunning tests; all 13 migrations deploy in order.
- Confirmed each decision and override writes both a `CatalogReview` row and an `AuditEvent` with hashed IP metadata.

## Milestone 8 — tests and quality gates

**Status:** Complete

**Completed work**

- Added unit coverage for dataset validation, QS import mapping, statuses, filters, comparison limits and advisor classification.
- Added integration coverage for visible-only catalog reads, pagination, favourites, comparison, notes, admin controls and advisor grounding.
- Ran the full local quality gate set after formatting and after the final lint cleanup.

**Modified files**

- `src/lib/advisor/classification.ts`
- `src/lib/advisor/tools.ts`
- `tests/unit/advisor-classification.test.ts`
- `tests/unit/advisor-tools.test.ts`
- `tests/integration/catalog-extensions.test.ts`
- `tests/integration/comparison-notes.test.ts`
- `src/components/admin/university-status-control.tsx`
- `src/components/catalog/comparison-button.tsx`

**Verified record count**

- No catalog rows changed; the database remains at **500** universities.

**Missing information**

- Live provider, production database and browser E2E checks are still external. No Git binary is available, so all work remains uncommitted.

**Tests run**

- `npm run typecheck` — passed.
- `npm test` — **227 passed / 32 files**.
- `npm run test:integration` — **82 passed / 10 files**.
- `npm run format:check` — all matched files use Prettier style.
- `npm run lint` — **0 errors, 0 warnings** after cleanup.
- `npm run build` — succeeded; all 36 static pages generated and all new dashboard routes present.
- `npx prisma validate` — schema valid.

**Fixes**

- Removed three unused imports reported by ESLint.
- Preserved exact QS rank strings in advisor explanations after an integration failure exposed the numeric-rank regression.
- Corrected the unranked-classification unit expectation.

## Milestone 9 — verification and documentation

**Status:** Complete

**Completed work**

- Verified the dataset directly: 500 records, 500 unique names, 500 unique QS node ids.
- Re-ran migrations, seed, QS import and `verify-qs-import` against a fresh isolated PGlite database to prove the exact-500 result is reproducible from an empty database.
- Updated architecture, database, AI advisor, data-sources and README documentation with the 500-university catalog, new statuses, comparison/notes, admin management, advisor classification and remaining boundaries.

**Modified files**

- `docs/ARCHITECTURE.md`
- `docs/DATABASE.md`
- `docs/AI-ADVISOR.md`
- `src/app/(marketing)/data-sources/page.tsx`
- `README.md`
- `docs/500-UNIVERSITIES-PROGRESS.md`

**Verified record count**

- Fresh isolated PGlite database on port `50902`: all 13 migrations applied; seed created 4 universities, 4 programmes, 2 scholarships and 18 requirement facts.
- Fresh import report: 500 dataset records, 496 newly created universities, 4 hand-verified universities updated but kept `VERIFIED`, 2,228 created programmes, 2,232 total programmes, 3,073 citations, 32,740 field facts, 646 skipped programme rows with unrecognized degree levels, 620 warnings (616 degree-level + 4 preserved-seed), **0 errors**.
- `npm run db:verify:qs` on that fresh database: `databaseUniversities: 500`, `exactly500: true`, `missingQsNids: []`, `mismatchedRankCount: 0`, `duplicateNames: []`, `legacyManchesterDuplicate: false`, status counts `PARTIALLY_VERIFIED: 496` and `VERIFIED: 4`.
- Dataset check: 500 records, 500 unique names, 500 unique QS node ids.

**Missing information**

- 155 universities have no confidently resolved official website; the UI renders an explicit unavailable state.
- 206 universities have no QS programme sample; their programme lists are empty or hand-verified.
- QS does not supply IELTS/TOEFL/SAT minima, deadlines, intake months, founded year, contact details, individual scholarship awards, credits or guaranteed English-taught status; those field facts are marked `INFORMATION_UNAVAILABLE`.
- QS tuition and programme fees are indicative third-party data stored as `PARTIALLY_VERIFIED`, not official university fee sheets.
- Playwright/browser E2E, production PostgreSQL, live AI provider checks and Git commit remain external.

**Tests run**

- Fresh-DB sequence: allocate isolated port and data directory → start PGlite → `prisma migrate deploy` → `npm run db:seed` → `npm run db:import:qs` → `npm run db:verify:qs`.
- All quality gates from Milestone 8 were re-run after the final edits.

**Fixes**

- No source fixes were needed for the fresh-DB run; the documented sequence starts from an empty database and applies all 13 migrations in order.

## Milestone 10 — handoff

**Status:** Complete

**Completed work**

- Produced the final operational handoff with exact counts, imports, test evidence, limitations and external verification steps.
- Confirmed the existing application was extended in place; no existing authentication, workspace, storage or advisor feature was replaced.

**Modified files**

- No additional source changes in this milestone; only this progress ledger was finalised.

**Verified record count**

- **500 distinct universities** (496 `PARTIALLY_VERIFIED`, 4 `VERIFIED`), 2,232 programmes, 32,740 field facts.

**Missing information**

- See the consolidated external gaps in Milestone 9 and the final report below.

**Tests run**

- Final quality gates: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:integration`, `npm run build`, `npx prisma validate`, plus the fresh-DB import verification.

**Fixes**

- None in this milestone.

## Final handoff

**Status:** Complete — all 10 milestones delivered.

### Delivered

- Exactly 500 distinct, source-backed universities with QS 2027 ranks preserved verbatim, including ties and ranges.
- Public and dashboard discovery with combined filters, 12-item pagination, field-level provenance, explicit unavailable states and source-linked detail pages.
- Four-way comparison, private research notes, favourites, saved scholarships and DB-backed application/deadline tracking with owner scoping.
- Reviewer decisions including `MARK_PARTIAL` and `MARK_UNAVAILABLE`, plus an `ADMIN`-only university management page with search, filters and audited status overrides.
- A grounded 11-tool AI advisor whose Reach / Target / Likely estimates use only stored QS rank bands, catalog tuition/degree/field facts and the saved budget, and are explicitly labelled as planning estimates.

### Exact verification evidence

- Fresh isolated PGlite verification on port `50902` applied all 13 migrations and seeded 4 universities, 4 programmes, 2 scholarships and 18 requirement facts.
- The QS importer then created 496 universities, kept the 4 hand-verified universities `VERIFIED`, created 2,228 programmes for 2,232 total, wrote 3,073 citations and 32,740 field facts, with **0 errors** and 620 non-fatal warnings.
- `npm run db:verify:qs` reported 500 database universities, `exactly500: true`, no missing QS ids, no rank mismatches, no duplicate names, no legacy Manchester duplicate, and status counts `PARTIALLY_VERIFIED: 496`, `VERIFIED: 4`.
- Full transcript: `C:\Users\user\AppData\Local\Temp\opencode\edubridge-fresh-verify\transcript.txt`.

### Final quality gates

| Gate                       | Result                                       |
| -------------------------- | -------------------------------------------- |
| `npm run format:check`     | All files match Prettier style               |
| `npm run lint`             | 0 errors, 0 warnings                         |
| `npm run typecheck`        | Passed                                       |
| `npm test`                 | 227 passed / 32 files                        |
| `npm run test:integration` | 82 passed / 10 files                         |
| `npm run build`            | Succeeded, 36 static pages, all routes built |
| `npx prisma validate`      | Schema valid                                 |

### Modified files by area

- **Research data:** `data/qs-2027-universities.json`, `data/.cache/qs-2027/`, `data/qs-2027-import-report.json`, `scripts/research-qs-universities.mjs`.
- **Schema and import:** `prisma/schema.prisma`, the three 500-university migrations plus `20261119020000_review_decision_partial_unavailable`, `scripts/import-qs-universities.mts`, `scripts/verify-qs-import.mts`, `scripts/cleanup-failed-qs-import.mts`, `src/lib/catalog/qs-import-mapping.ts`.
- **Catalog services:** `src/lib/catalog/constants.ts`, `queries.ts`, `discovery-queries.ts`, `discovery-filters.ts`, `filters.ts`, `format.ts`, `provenance.ts`, `review-service.ts`, `review-validation.ts`, `comparison.ts`, `notes.ts`, `favorites.ts`.
- **UI and routes:** public and dashboard university list/detail pages, `/dashboard/comparison`, `/dashboard/notes`, `/dashboard/admin/universities`, review pages/actions, `src/components/catalog/*`, `src/components/admin/*`, `src/components/dashboard/dashboard-nav.tsx`.
- **Advisor:** `src/lib/advisor/classification.ts`, `tools.ts`, `prompt.ts`, `src/app/dashboard/advisor/page.tsx`, advisor tests.
- **Tests:** `tests/unit/qs-import-mapping.test.ts`, `tests/unit/advisor-classification.test.ts`, `tests/unit/advisor-tools.test.ts`, `tests/integration/comparison-notes.test.ts`, `tests/integration/catalog-extensions.test.ts`, plus updated catalog/discovery tests.
- **Documentation:** `README.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/AI-ADVISOR.md`, `docs/500-UNIVERSITIES-PLAN.md`, `docs/500-UNIVERSITIES-PROGRESS.md`, `src/app/(marketing)/data-sources/page.tsx`.

### Missing information and external boundaries

- 155 universities have no confidently resolved official website; the UI renders an explicit unavailable state.
- 206 universities have no QS programme sample; those profiles have no invented programme list.
- IELTS/TOEFL/SAT minima, deadlines, intake months, founded years, contact details, scholarship award amounts, credits and guaranteed English-taught status are not supplied by the selected sources and are stored as `INFORMATION_UNAVAILABLE`.
- QS tuition and programme fees are indicative third-party figures stored as `PARTIALLY_VERIFIED`, not official fee sheets.
- Live AI provider quality/latency/billing, managed PostgreSQL, production S3/ClamAV/telemetry, browser E2E and Git commit remain external to this environment. No Git binary is available, so all changes are uncommitted.

### Operational commands

```bash
npm run db:start
npm run db:migrate
npm run db:seed
npm run db:import:qs
npm run db:verify:qs
npm test
npm run test:integration
npm run typecheck
npm run lint
npm run format:check
npm run build
```

## Follow-up — applications board development

**Status:** Complete

**Completed work**

- Added pure application-board helpers for summary metrics, deadline urgency, document readiness, URL-backed filters, sorting, attention grouping, and deterministic UTC deadline labels.
- Rebuilt `/dashboard/applications` with four private-data summary cards, an overdue/due-soon attention panel, search, status and deadline filters, sorting, empty-filter states, and per-card quick status moves.
- Added an owner-scoped `setApplicationStatus` service mutation and `setApplicationStatusAction`; board moves preserve notes, deadline, and progress while recording one status-history event and a preference-aware notification.
- Added urgency and document-readiness context to the application detail page and clarified on the add page that saved deadlines are private tracker entries, not catalog facts.
- Added unit coverage for board parsing/filtering/sorting/metrics/urgency and integration coverage for quick status changes and owner scoping.

**Modified files**

- `src/lib/workspace/application-board.ts` (new)
- `src/lib/workspace/service.ts`
- `src/app/dashboard/workspace-actions.ts`
- `src/app/dashboard/applications/page.tsx`
- `src/app/dashboard/applications/[applicationId]/page.tsx`
- `src/app/dashboard/applications/new/page.tsx`
- `tests/unit/application-board.test.ts` (new)
- `tests/integration/workspace.test.ts`
- `docs/API.md`

**Verified record count**

- Development database still reports 500 universities; this change does not alter catalog data.
- Browser verification used four private tracker applications across Interested, Preparing documents, Submitted, and Accepted states, including one overdue and one due-soon deadline.

**Missing information**

- Application deadlines and statuses are student-entered workspace data; they are not university-specific catalog facts and carry no catalog provenance.
- No numerical scholarship or admission-probability claim is made by the board.

**Tests run**

- `npm run format`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:integration`, `npm run build`, `npx prisma validate`.

**Fixes**

- Removed a duplicate initial status-history write when application creation moved to the shared status-change helper.
