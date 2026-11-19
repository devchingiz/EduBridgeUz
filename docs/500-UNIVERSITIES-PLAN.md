# 500-university source-backed catalog — implementation plan

## Scope

Extend the existing EduBridge application (do not replace it) with exactly 500 distinct, real universities. Rankings use QS World University Rankings 2027 as the primary reference when a university is ranked. No fact is guessed: fields that the sources do not provide are stored as unavailable.

This plan is intentionally executable in milestones. Progress and verification evidence are recorded in `docs/500-UNIVERSITIES-PROGRESS.md`.

## Source strategy

| Source                                                              | Used for                                                                                                                                                                                                       | Publication treatment                                                                                                                                              |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| QS TopUniversities public university index (`live_tu_universities`) | Official QS institution name, campus country/city, QS 2027 `wur_rank` (ties preserved), public/private status, scholarship flag, indicative international tuition, logo, QS description, canonical profile URL | Ranking-backed facts are `Partially verified` because QS is the publisher, not the institution; each fact cites the QS profile URL and the QS ranking edition/date |
| Wikipedia API + Wikidata `P856`                                     | Official website where a confident title match exists                                                                                                                                                          | `Partially verified` with both the Wikipedia match and Wikidata P856 claim URL                                                                                     |
| QS TopUniversities public programmes index (`live_tu_programs`)     | Real programme names, degree/level, duration, study mode, indicative fees, canonical programme URL                                                                                                             | `Partially verified`; QS indicative fees are not official university fee sheets                                                                                    |
| Existing hand-verified seed sources                                 | Existing four universities, programmes and scholarships                                                                                                                                                        | Keep `Verified`; never overwrite with weaker QS data                                                                                                               |

### Statuses

The app already has record-level `VerificationStatus`. To satisfy the requested user-facing vocabulary without losing existing review semantics, add:

- `PARTIALLY_VERIFIED` — sourced, but from an authoritative third party rather than the institution's own current page.
- `INFORMATION_UNAVAILABLE` — no trustworthy source value; display an explicit unavailable state.

Keep `VERIFIED`, `NEEDS_REVIEW`, `UNVERIFIED`, `EXPIRED`, `ARCHIVED` for existing records and review workflows. Add a generic field-level fact model with the four requested statuses:

- `Verified`
- `Partially verified`
- `Not verified`
- `Information unavailable`

### Fields explicitly unavailable from the selected sources

IELTS/TOEFL/SAT minima, application deadlines, intake months, founded year, contact email/phone/postal address, individual scholarship award amounts, credits, and language-of-instruction guarantees are not invented. The importer writes field facts with `INFORMATION_UNAVAILABLE` for these where the UI exposes them.

## Data model changes

1. Extend `University` with ranking, continent, institution type, logo, description, and QS node identity. Make `websiteUrl` nullable so an unknown official website is never fabricated.
2. Add `FieldVerificationStatus` and `CatalogFieldFact` for field-level provenance (entity, field key, display value, status, source, verification date, academic year, intake, currency/unit, note).
3. Add `UniversityComparison` (one row per user, max four IDs enforced in code and action validation).
4. Add `StudyNote` for student research notes linked optionally to a university, programme or scholarship.
5. Add admin catalog audit actions through the existing `AuditEvent`/`CatalogReview` pattern.

## Milestones

### Milestone 1 — architecture and plan

- Map schema, queries, pages, advisor tools, workspace, seed/import patterns, UI system, tests and migrations.
- Read installed Next.js 16 agent guidance and relevant docs.
- Write this plan and the progress ledger.

### Milestone 2 — research dataset

- Produce `data/qs-2027-universities.json` with exactly 500 unique QS 2027 records.
- Preserve tie strings exactly (`=2`, `=530`, ranges such as `951-1000`).
- Guarantee representation from the requested countries and report gaps.
- Cache network enrichment so reruns resume after interruption.

### Milestone 3 — schema, migration and import pipeline

- Add the models/enums above and a hand-authored PostgreSQL migration.
- Build a reusable importer: validation, duplicate detection, stable slugs, idempotent upserts, source citations, field facts, review/audit records, error report and summary.
- Import the 500 records locally and verify the database count.

### Milestone 4 — discovery, detail UI and provenance

- Expose ranking, continent, type, logo, description, website availability and field-level statuses in public and dashboard discovery.
- Add advanced combined filters, server-side pagination, comparison selection and a four-way comparison view.
- Keep all external links and icons sourced; missing values render as unavailable.

### Milestone 5 — student workspace

- Wire favourites and saved scholarships to the enlarged catalog.
- Add comparison and notes, and ensure applications/deadlines remain DB-backed and user-scoped.
- Maintain ownership checks and same-origin server actions.

### Milestone 6 — AI advisor grounding

- Ensure advisor tools read the 500-university catalog and return provenance/status.
- Mark Reach/Target/Likely as heuristic estimates derived from real DB fields, never promises.
- Update the prompt and tests; live provider checks remain external without an API key.

### Milestone 7 — admin management

- Add an ADMIN-only university management page with search, filters, status changes, source inspection and audit logging.
- Reuse the existing RBAC/session recheck pattern from `/dashboard/admin/users`.

### Milestone 8 — tests and quality gates

- Unit tests for dataset validation, import mapping, statuses, filters, comparison limits and advisor classification.
- Integration tests for 500-record visibility, pagination, favourites, comparison, notes, admin controls and advisor grounding.
- Run `npm test`, `npm run test:integration`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`.

### Milestone 9 — verification and documentation

- Report exact record count, source coverage, missing fields and known limitations.
- Update architecture/database/data-sources docs.
- Record browser QA limits (no Playwright in this environment).

### Milestone 10 — handoff

- Final milestone report with modified files, test results, remaining gaps and operational commands.

## Non-goals / constraints

- Do not claim QS indicative tuition is an official fee sheet.
- Do not fabricate rankings for unranked institutions.
- Do not call research APIs at request time.
- Do not rebuild the existing auth, billing-free workspace or advisor infrastructure.
- No Git is available in this environment; changes remain uncommitted.
