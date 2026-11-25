# Private file operations

This runbook covers the S3-compatible document store, ClamAV scanner, backups,
and recovery. Do not put credentials in this document, command history, or source
control. Inject secrets through the deployment platform's secret manager or
workload identity.

## Local development (no external services)

For local development only, `.env.local` can opt into filesystem-backed storage
and a signature-based scan driver:

```dotenv
STORAGE_DRIVER="local"
STORAGE_LOCAL_DIR=".data/storage"
MALWARE_SCANNER_DRIVER="local"
```

This runs the same quarantine → promote lifecycle on disk, so upload, preview,
rename, link, delete, and the EICAR quarantine path can all be exercised without
an S3 provider or a `clamd` daemon. The local scanner treats the standard EICAR
test signature as infected and everything else as clean; it is **not** a
substitute for real antivirus scanning. Both local drivers throw when
`NODE_ENV=production`, and `productionConfigurationIssues()` still requires the
full S3 and clamd settings, so a deployment cannot silently downgrade.

Use a disposable `STORAGE_LOCAL_DIR` and clear it when you want a clean library.
Production configuration is unchanged and documented below.

## Configure object storage

1. Create separate document and backup buckets in the chosen S3-compatible
   provider. Enable Block Public Access, disable public ACLs and website
   hosting, require TLS, and enable provider access logging.
2. Set `STORAGE_REGION`, `STORAGE_BUCKET`, and `STORAGE_BACKUP_BUCKET`.
   `STORAGE_ENDPOINT` is optional and must be HTTPS outside local development.
3. Use a workload identity where available. Otherwise inject
   `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, and an optional
   `STORAGE_SESSION_TOKEN` through the secret manager. Never reuse a full
   administrator credential.
4. Configure `STORAGE_SERVER_SIDE_ENCRYPTION=AES256`, or `aws:kms` with
   `STORAGE_KMS_KEY_ID` and narrowly scoped key permissions.
5. Grant the application access only to required `documents/` and
   `quarantine/` object operations. Give the backup job list/read access to
   clean document objects and read/write access only to `backups/` in the
   separate backup bucket. Do not grant public access.
6. Configure a one-day expiration for `quarantine/`, including incomplete
   multipart uploads. Configure `backups/` expiration to 35 days and expire
   incomplete multipart uploads. Adjust retention only after the applicable
   privacy, legal, and recovery requirements have been reviewed.

Downloads are streamed through the application's authenticated route after a
workspace and document-owner check. Do not expose a bucket URL or add presigned
URLs to the UI; a direct URL would bypass the route's per-request ownership
check. S3 SDK retries transient requests up to three attempts.

## Configure malware scanning

Run ClamAV `clamd` on a private network reachable only by the application.
Inject `MALWARE_SCANNER_HOST` and `MALWARE_SCANNER_PORT` through the deployment
configuration. Do not expose the clamd TCP port publicly. Configure
`StreamMaxLength` and `MaxFileSize` above the application's 5 MiB upload cap
(including protocol overhead), and keep signatures updated.

The application stages content in `quarantine/` as opaque binary data. Only an
explicit clean INSTREAM verdict allows promotion to `documents/`. An infected
file remains quarantined and is not associated with a student document record.
Scanner errors fail closed and produce a generic retry message. Redacted audit
events record pending, clean, infected, scanner-failed, and processing-failed
states without file names or file contents.

## Schedule backups

Install PostgreSQL client tools (`pg_dump` and `pg_restore`) on a restricted
job runner with network access to PostgreSQL and the two private buckets.
Provide `DATABASE_URL` and `STORAGE_*` values through the job's secret store.
Schedule `npm run db:backup` at the deployment-selected cadence; for example,
daily at 02:00 local time with a standard cron scheduler:

```cron
0 2 * * * cd /srv/edubridge && npm run db:backup
```

The scheduler must report non-zero exit status and alert on missed runs. The
backup command creates a custom-format database dump and a versioned object
manifest with SHA-256 and byte-length checks for every document and the dump.
It writes the completion manifest last, so incomplete backup prefixes are not
restorable. Retention is enforced by the backup-bucket lifecycle policy.

For a consistent snapshot, pause document uploads/deletes and related database
writes for the duration of a backup. The database and object store do not share
a transaction; restore verification deliberately fails if document references
in the restored database do not exactly match the manifest.

## Restore and verify

Restore only into a new isolated recovery database and an empty private
document bucket. Verify both targets before running the restore. The CLI now
normalises both PostgreSQL URLs (scheme, host case, default port, trailing
slash) and refuses a target whose identity or database name matches the
configured primary `DATABASE_URL`. It also requires `RESTORE_TARGET_NAME` to
match the recovery database name exactly and refuses a destination bucket that
already contains objects. These are application-side guards: two different
hostnames could still resolve to the same database, so provider IAM and network
separation remain mandatory.

1. Set `BACKUP_ID`, `RESTORE_CONFIRM=RESTORE`, `RESTORE_TARGET_NAME`,
   `RESTORE_DATABASE_URL`, and `RESTORE_DOCUMENT_BUCKET`, along with the normal
   storage settings. Do not put the production database URL in
   `RESTORE_DATABASE_URL`.
2. Run `npm run db:restore`. The script validates the guards above, validates
   the versioned manifest and UUID object keys, checks hashes and byte lengths
   while copying objects, verifies the database dump checksum, and runs
   `pg_restore` with `--exit-on-error`. The restore job needs list permission
   on the empty destination bucket in addition to object-write permission.
3. It compares all restored `StudentDocument.storageKey` values against the
   manifest and fails on missing or extra object references.
4. Start the application against the recovery targets and verify representative
   documents through authenticated owner accounts, including that another
   account receives `404`. Confirm object bytes, document names/categories, and
   application links before approving any cutover.
5. Record the backup ID, verification date, observed recovery duration, and any
   incident/remediation in the deployment's operational log.

Define and approve RPO/RTO, key-recovery procedures, and retention before
production. A successful local unit test is not a substitute for a periodic
restore drill against the production provider and managed PostgreSQL. Coordinate
this drill with [managed PostgreSQL staging verification](STAGING-DATABASE-VERIFICATION.md).
