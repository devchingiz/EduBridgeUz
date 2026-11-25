# Managed PostgreSQL staging verification

This runbook covers the remaining database launch gates: migration replay, TLS,
pooling, roles, application integration, and a provider-level backup/restore
drill. It never references a real connection string or credential. Inject all
values from the operator secret store and never paste them into source control,
chat, command history, or logs.

**Scope: staging only.** Do not point any command in this document at a
production project, branch, database, bucket, or role. Do not deploy the
application as part of this verification.

## Classification legend

Use these labels in the final report:

- **A. Verified** — actually executed against the separate staging provider and
  evidence recorded.
- **B. Failed** — executed and did not meet the requirement.
- **C. Not tested** — not executed.
- **D. Requires manual provider configuration** — provider-side setup or access
  is missing and must be supplied by an operator.

## Provider and version requirements

The application policy in [`DEPLOYMENT.md`](DEPLOYMENT.md) requires managed
**PostgreSQL 16 or newer**. Prisma `6.19.3` supports PostgreSQL through 18 and
lists Neon as a managed provider. Neon currently supports PostgreSQL 14–19; for
this exercise select **16, 17, or 18** on a new staging project. Do not use 19
for sign-off while the application is pinned to Prisma 6, and do not assume the
provider default is the intended target.

The 17 committed migrations use enum types, PostgreSQL array columns,
`ALTER TYPE ... ADD VALUE`, indexes, foreign keys, and two SQL-only `CHECK`
constraints. No extensions are required. Record the exact server version with
the verification script's `SELECT version()` result; do not infer it from the
provider console label.

## Phase 2 — manual provider configuration

### 1. Create an isolated staging database

In the provider console, manually create:

| Item               | Requirement                                                         |
| ------------------ | ------------------------------------------------------------------- |
| Project/account    | A separate staging project, not a branch of the production project. |
| PostgreSQL version | 16, 17, or 18. Record the selected version.                         |
| Database           | A new empty database, for example `edubridge_staging`.              |
| Credentials        | New staging-only roles. Never reuse production credentials.         |
| Data               | No production dumps, snapshots, branches, or copied rows.           |

If the provider cannot supply a separate project or an empty staging database,
stop and record the item as **D**.

### 2. Separate the application and migration roles

Create two staging roles with distinct credentials:

- `edubridge_app` — used by the running application through the pooled endpoint.
- `edubridge_migrator` — used only by the release/verification job through the
  direct endpoint.

Both roles must be ordinary login roles. Neither may be a superuser. The app
role must not have `CREATEDB`, `CREATEROLE`, `REPLICATION`, `BYPASSRLS`, or
`CREATE` on `public`. The migrator role needs schema `CREATE` and ownership of
migration-created objects, but still must not be a superuser.

Review exact grants in the provider console or SQL editor after migration; the
verification script reports the effective privileges of the connected role.
Do not revoke anything until the application has been re-tested.

### 3. Copy both endpoints from the provider

Neon exposes two connection strings in the console:

| Endpoint | Identification                      | Use                                                                  |
| -------- | ----------------------------------- | -------------------------------------------------------------------- |
| Pooled   | Hostname contains `-pooler`         | `DATABASE_URL` for the running app and application health checks.    |
| Direct   | Hostname does not contain `-pooler` | Prisma CLI, `pg_dump`, `pg_restore`, and read-only SQL verification. |

Never derive credentials by hand. Copy the provider-generated values into the
secret store only. Merge TLS and timeout parameters; do not duplicate them.

The pooled application URL must include:

- `sslmode=verify-full` (or `verify-ca` with the provider CA configured).
- `channel_binding=require` where supported; never `disable`.
- Positive integer `connect_timeout`, `pool_timeout`, and `connection_limit`.

The direct URL must include validating TLS and a positive `connect_timeout`.
Do not add `pgbouncer=true` unless the provider's Prisma documentation requires
it; that parameter is only used by the local PGlite development server.

Keep `connection_limit` × web replicas within the provider's connection budget.
The verification script reports the server's `maxConnections` value.

### 4. Configure secret-store variables

Set these in the staging secret store or an operator shell fed by that store:

| Variable                                                                                                 | Purpose                                                                                      |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                                                           | Staging app pooled endpoint. Never a production value.                                       |
| `STAGING_DATABASE_URL`                                                                                   | Same pooled endpoint, read explicitly by the verification helper.                            |
| `STAGING_DATABASE_URL_DIRECT`                                                                            | Direct endpoint for Prisma CLI and SQL checks.                                               |
| `STAGING_CONFIRM`                                                                                        | Must be exactly `STAGING`; prevents accidental use.                                          |
| `STAGING_CONFIRM_MIGRATE`                                                                                | Must be exactly `MIGRATE`; required only for migration apply.                                |
| `STAGING_ALLOW_EXISTING`                                                                                 | Set to `YES` only when intentionally replaying onto a non-empty staging database.            |
| `STAGING_POOLED_HOST_MARKER`                                                                             | Provider marker; use `-pooler` on Neon.                                                      |
| `STAGING_FORBIDDEN_IDENTITY`                                                                             | Optional credential-free identity to refuse, formatted as `postgresql://host:port/database`. |
| `STAGING_SHADOW_DATABASE_URL`                                                                            | Separate disposable managed database for `prisma migrate diff`.                              |
| `STAGING_INTEGRATION_DATABASE_URL`                                                                       | Separate disposable managed database for integration tests.                                  |
| `STAGING_CONFIRM_TESTS`                                                                                  | Must be exactly `TESTS`; required with the integration URL.                                  |
| `STAGING_APP_URL`                                                                                        | Public HTTPS origin of the staging deployment for health checks.                             |
| `BACKUP_ID`, `RESTORE_CONFIRM`, `RESTORE_TARGET_NAME`, `RESTORE_DATABASE_URL`, `RESTORE_DOCUMENT_BUCKET` | Restore drill only; see [`FILE-OPERATIONS.md`](FILE-OPERATIONS.md).                          |

The verification helper refuses to connect until `STAGING_CONFIRM=STAGING` is
set. Its output contains endpoint facts and counts, never URLs, passwords, or
query-string values. Child-process output is redacted.

### 5. Provider backup configuration

In the provider console, confirm the staging plan's snapshot/PITR capability
and retention window. On Neon, instant restore and PITR apply to root branches;
history windows vary by plan. Snapshots are available on all plans with plan
limits. Record the observed settings rather than assuming them.

## Phase 3 — migration replay

1. Confirm the target is newly created and empty. Do **not** reset an existing
   database.
2. From an operator shell with the variables above injected, run:

   ```sh
   npm run staging:verify -- preflight
   npm run staging:verify -- check
   ```

   The `check` mode is read-only and reports server version, TLS state, role
   flags, object counts, critical tables, SQL-only `CHECK` constraints, and the
   current `_prisma_migrations` history.

3. Apply migrations only after the empty-database check passes:

   ```sh
   # STAGING_CONFIRM=STAGING and STAGING_CONFIRM_MIGRATE=MIGRATE injected
   npm run staging:verify -- migrate
   ```

   That helper runs `prisma validate`, `prisma migrate deploy`, and
   `prisma migrate status` against the **direct** staging endpoint and then
   re-reads schema state. It never uses `prisma db push` and never resets.

   The equivalent explicit commands, with values injected from the secret
   store, are:

   ```sh
   DATABASE_URL="$STAGING_DATABASE_URL_DIRECT" npx prisma validate
   DATABASE_URL="$STAGING_DATABASE_URL_DIRECT" npx prisma migrate deploy
   DATABASE_URL="$STAGING_DATABASE_URL_DIRECT" npx prisma migrate status
   ```

4. Compare committed migrations with the schema on a separate disposable
   managed shadow database:

   ```sh
   npx prisma migrate diff \
     --from-migrations prisma/migrations \
     --to-schema-datamodel prisma/schema.prisma \
     --shadow-database-url "$STAGING_SHADOW_DATABASE_URL" \
     --exit-code
   ```

   The expected result is `No difference detected.` A local PGlite replay is
   not a substitute for this provider-side check.

5. Re-run `npm run staging:verify -- check` and record: all 17 migration names
   finished and not rolled back, critical tables present, both SQL-only `CHECK`
   constraints present, and non-zero table/enum/index/foreign-key counts.

## Phase 4 — TLS and pooling

Evidence to record:

- `npm run staging:verify -- check` shows TLS active on the direct connection,
  a validating `sslmode`, and no disabled `channel_binding`.
- The pooled URL uses the provider marker (`-pooler` on Neon) and the direct URL
  does not. Set `STAGING_POOLED_HOST_MARKER=-pooler` to make the helper enforce
  this.
- `connection_limit`, `connect_timeout`, and `pool_timeout` are positive
  integers on the pooled URL; `connect_timeout` is positive on the direct URL.
- Reported `maxConnections` is large enough for
  `connection_limit × web replicas` plus migration and backup jobs.
- A controlled failover/unavailability test returns a generic `503` from
  `/api/health/ready` within its 3-second database probe and the orchestrator
  removes the instance from rotation. Do not disable TLS or relax the timeout
  to make this test pass.

Neon scale-to-zero can make a cold connection take longer than the readiness
probe permits. Keep the staging compute warm or disable scale-to-zero for the
test, and document the deployment decision; do not silently change production
code.

## Phase 5 — database roles

Run `npm run staging:verify -- check` with the migrator role in
`STAGING_DATABASE_URL_DIRECT`. Record that the role is not superuser and has no
`createdb`, `createrole`, `replication`, or `bypassrls`. Then run the application
integration suite with the app role and confirm every required operation works.

If grants are tightened, repeat the migration-status check and integration
suite. Do not infer correctness from role flags alone.

## Phase 6 — application verification

1. Start the staging deployment with staging-only secrets. Keep
   `EMAIL_TRANSPORT=console` unless a controlled test SMTP sink is explicitly
   configured; the integration config forces console delivery.
2. Check health endpoints:

   ```sh
   # STAGING_CONFIRM=STAGING and STAGING_APP_URL injected
   npm run staging:verify -- health
   ```

   Record `/api/health/live` and `/api/health/ready` status codes. Readiness
   also checks semantic production configuration; provide staging-valid values
   for required settings, never production secrets.

3. Run the existing integration suite against a **separate** disposable managed
   staging database:

   ```sh
   # STAGING_CONFIRM=STAGING, STAGING_CONFIRM_TESTS=TESTS,
   # and STAGING_INTEGRATION_DATABASE_URL injected from the secret store
   npm run test:integration
   ```

   The harness refuses to start unless both confirmations are present, requires
   validating TLS, and refuses to reuse the migration replay database or an
   explicitly forbidden identity. It does not write the credential to disk.
   Tests use synthetic accounts and records and cover registration/login,
   sessions, verification/reset database operations, workspace document
   metadata, authorization, and shared rate-limit/transaction behavior.

4. Do not send real email or create real user data. Do not run this suite
   against the production database.

## Phase 7 — backup and restore drill

A drill is not passed until a restore was actually performed and verified.

### Provider-level path (Neon)

1. Create synthetic staging rows with a unique drill marker and record their
   IDs and counts.
2. Create a manual snapshot or identify a PITR timestamp after those writes.
   Confirm instant restore is available for the chosen branch; on Neon it is
   root-branch only.
3. Add a second synthetic marker after the backup point.
4. Restore into a **new** isolated recovery branch/database. Never restore over
   the original staging database and never into production.
5. Query the recovery target and verify the first marker is present, the second
   marker is absent, and schema/record counts match expectations.
6. Point a temporary application instance at the recovery target with
   `RESTORE_DATABASE_URL` and verify representative synthetic records through
   authorized requests.
7. Record start/end time, backup ID or timestamp, restored counts, integrity
   results, and limitations.

### Application-level path

Use [`FILE-OPERATIONS.md`](FILE-OPERATIONS.md) and the existing `npm run
db:backup` / `npm run db:restore` scripts with staging-only secrets. Restore
requires `RESTORE_CONFIRM=RESTORE`, a distinct empty destination document
bucket, and `RESTORE_TARGET_NAME` matching the isolated recovery database. The
scripts use the direct endpoint via `pg_dump`/`pg_restore`; application-side
guards cannot prove provider isolation, so confirm IAM/network separation in
the console.

If provider access, snapshots, or a safe recovery target are unavailable,
record the item as **D** with the exact manual steps that remain.

## Final report template

| Item                                             | Classification | Evidence or blocker |
| ------------------------------------------------ | -------------- | ------------------- |
| Provider and exact PostgreSQL version            |                |                     |
| Migration replay and status                      |                |                     |
| Schema objects, indexes, enums, constraints, FKs |                |                     |
| TLS negotiation and validating mode              |                |                     |
| Pooled/direct endpoint usage and limits          |                |                     |
| Role and permission review                       |                |                     |
| Health and readiness endpoints                   |                |                     |
| Integration tests on staging                     |                |                     |
| Provider backup/restore drill                    |                |                     |
| Overall database sign-off                        |                |                     |

Local tests and builds alone never justify **A** for provider-dependent items.
