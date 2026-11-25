# Production deployment

This project is a single Next.js 16 App Router service. The production image
uses Next.js standalone output and runs as a non-root user. PostgreSQL, private
S3-compatible document/backup buckets, ClamAV, SMTP, an AI provider, and an
OpenTelemetry collector are external services; this repository does not provision
them.

## Required production configuration

Set these values in the deployment platform's secret/configuration store. Never
commit a production `.env` file or pass secrets as Docker build arguments.

| Variable                                                                                                 | Requirement                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`                                                                                    | Public HTTPS origin; provide at image build time for the client bundle and at runtime for server-generated links.                                                                        |
| `DATABASE_URL`                                                                                           | PostgreSQL 16+ URL with `sslmode=require\|verify-ca\|verify-full`, positive integer `connect_timeout`, `pool_timeout`, and `connection_limit`; readiness rejects missing/invalid values. |
| `AUTH_SECRET`                                                                                            | At least 32 random characters; server-only.                                                                                                                                              |
| `MFA_ENCRYPTION_KEY`                                                                                     | At least 32 random characters; encrypts TOTP seeds at rest. Must be stable for the life of enrolled accounts; losing it requires a re-enrollment plan.                                   |
| `HIBP_ENABLED`                                                                                           | Optional outside production to enable breached-password checks; production always enforces them regardless of this value.                                                                |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                                                               | Google OAuth client credentials; register `https://<app-host>/api/auth/google/callback` as an authorized redirect URI.                                                                   |
| `EMAIL_TRANSPORT`                                                                                        | `smtp`; console delivery is development-only.                                                                                                                                            |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE`, `EMAIL_FROM`                      | SMTP connection and sender configuration; `EMAIL_FROM` must be deliverable in production and credentials remain server-only.                                                             |
| `SECURITY_CONTACT_EMAIL`, `PRIVACY_CONTACT_EMAIL`                                                        | Published, deliverable addresses for vulnerability reports and data-rights requests; reserved/placeholder domains are rejected.                                                          |
| `STORAGE_REGION`, `STORAGE_BUCKET`, `STORAGE_BACKUP_BUCKET`                                              | Distinct private buckets; see [file operations](FILE-OPERATIONS.md).                                                                                                                     |
| `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_SESSION_TOKEN`                            | Optional when using workload identity; inject credentials as secrets and grant least privilege.                                                                                          |
| `STORAGE_ENDPOINT`                                                                                       | Optional S3-compatible endpoint; production endpoints must use HTTPS.                                                                                                                    |
| `STORAGE_SERVER_SIDE_ENCRYPTION`, `STORAGE_KMS_KEY_ID`                                                   | Storage encryption configuration; KMS key is required for `aws:kms`.                                                                                                                     |
| `MALWARE_SCANNER_HOST`, `MALWARE_SCANNER_PORT`                                                           | Private ClamAV `clamd` endpoint; uploads fail closed if scanning is unavailable.                                                                                                         |
| `BACKUP_ID`, `RESTORE_CONFIRM`, `RESTORE_TARGET_NAME`, `RESTORE_DATABASE_URL`, `RESTORE_DOCUMENT_BUCKET` | Restore-only job variables. The target database must be isolated and explicitly named; the destination document bucket must be empty. See [file operations](FILE-OPERATIONS.md).         |
| `OTEL_EXPORTER_OTLP_ENDPOINT`                                                                            | HTTP(S) OpenTelemetry collector endpoint; required for production readiness.                                                                                                             |
| `OTEL_EXPORTER_OTLP_HEADERS`                                                                             | Optional collector authorization headers; inject through the secret store.                                                                                                               |
| `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`                                                                  | Required for the AI Advisor. Provider key is server-only; see [AI Advisor](AI-ADVISOR.md).                                                                                               |
| `AI_BASE_URL`                                                                                            | Required for `AI_PROVIDER=compatible`; optional override otherwise. Must be HTTPS in production.                                                                                         |
| `AI_TIMEOUT_MS`, `AI_MAX_*`, `AI_MESSAGES_PER_MINUTE`, `AI_DAILY_*`                                      | Validate timeout/context limits and real cost caps before enabling production traffic.                                                                                                   |
| `AI_PRICE_INPUT_PER_MILLION`, `AI_PRICE_OUTPUT_PER_MILLION`                                              | Optional pricing overrides when the configured model is not in the built-in table.                                                                                                       |

Use separate credentials and endpoints for development, tests, previews, and
production. `.env.example` is a local-development template, not a production
configuration. `NEXT_PUBLIC_*` variables are public and must never contain a
secret.

Google sign-in uses the authorization-code flow with PKCE and requires a
verified Google email. Create an OAuth client in Google Cloud Console, enable
the Google identity/OpenID Connect endpoints, and register the exact callback
URL for each environment. Keep the client secret server-only. New Google
registrations still collect date of birth and terms acceptance; minor accounts
remain locked until guardian consent is recorded. Email verification is a
workspace access requirement after the configured rollout deadline, and the
readiness endpoint rejects a missing or malformed rollout timestamp.

Password registration, reset, and change call the HIBP k-anonymity range API.
Allow outbound HTTPS to `api.pwnedpasswords.com`; production fails closed when
that egress or the provider is unavailable.

Opt-in TOTP MFA uses the `20261124000000_mfa` migration (new nullable `User`
columns, a new recovery-code table, and an added `MFA_CHALLENGE` token-purpose
value). Apply it like every other migration before enabling the feature; it does
not rewrite existing rows. `MFA_ENCRYPTION_KEY` must be present before any user
enrolls. Back it up with the same controls as `AUTH_SECRET`: an operator who
loses it cannot decrypt enrolled seeds and every affected account must
re-enroll. MFA is not mandatory yet, and Google sign-in does not prompt for a
second factor; keep those gaps in mind if the account recovery policy assumes
MFA is universal.

## Build and release

Build the image with the public URL only:

```sh
docker build \
  --build-arg NEXT_PUBLIC_APP_URL=https://app.example.edu \
  --tag edubridge:release .
```

The image starts the Next.js standalone server on port `3000`, listens on
`0.0.0.0`, runs as an unprivileged user, and handles `SIGTERM`. Next.js's
self-hosted Node server drains requests on termination; configure the platform
with a termination grace period of at least 30 seconds. Do not start a second
custom server or run database migrations in every web replica.

Before routing traffic to a release, run `npx prisma migrate deploy` once from a
restricted release job using the production `DATABASE_URL`. The standalone web
image intentionally does not include Prisma CLI or migration tooling. Keep the
previous image available for rollback and apply only backward-compatible
migrations while old and new replicas may overlap. `npm run db:push` is guarded
to loopback, non-production URLs and must not be used as a substitute; never run
`prisma db push` directly against a remote instance.

Configure the ingress/load balancer to terminate HTTPS, forward requests only
to the application port, and overwrite client-supplied `X-Forwarded-For`,
`X-Real-IP`, and `X-Forwarded-Host` with trusted values (or reject requests
that carry them). Strip client-supplied forwarded headers before the ingress
adds its own values; the application reads the leftmost `X-Forwarded-For` entry
and then `X-Real-IP`, and validating IP syntax cannot prove those headers came
from the proxy. If a proxy forwards untrusted values or appends to a
client-supplied chain, attackers can rotate forwarded IPs and evade IP-based
rate limits; this cannot be prevented by application code alone.

Production sessions use `Secure`, `HttpOnly`, and `SameSite=Lax` cookies;
`NEXT_PUBLIC_APP_URL` must match the browser-visible HTTPS origin. HSTS is sent
in production and includes subdomains, so enable it only for a domain whose
subdomains are HTTPS-ready.

There is no public JSON API or cross-origin client. CORS is intentionally not
enabled; keep browser requests same-origin rather than adding a wildcard CORS
policy. Same-origin mutation checks and server-side authorization remain
required.

## CI and repository host configuration

The repository contains two GitHub Actions workflows and a Dependabot
configuration:

- `.github/workflows/ci.yml` runs on every push and pull request. Its `verify`
  job installs with `npm ci`, runs high-severity `npm audit` on both the full and
  production-only dependency trees, then lint, typecheck, `npm run test:all`
  (unit plus PGlite integration tests), formatting, `npm run build`, a Docker
  image build, and a Trivy `HIGH,CRITICAL` image scan that uploads SARIF to code
  scanning. Its `dependency-review` job runs on pull requests and fails on high
  severity runtime or development dependency changes. Its `secret-scan` job runs
  Gitleaks across the full git history.
- `.github/workflows/codeql.yml` runs CodeQL `javascript-typescript` analysis on
  pushes, pull requests, and a weekly schedule.
- `.github/dependabot.yml` opens weekly npm and GitHub Actions update pull
  requests (up to ten open per ecosystem).

Every `uses:` reference is pinned to a full commit SHA. CI uses a CI-only auth
secret, console email delivery, and a local PGlite database; no production
credentials are used.

These repository-host settings cannot be verified from the repository and are
launch gates for the operator:

- Require the `verify`, `dependency-review`, `secret-scan`, and CodeQL `analyze`
  checks to pass before merging, together with an approving review. Exact check
  names depend on how the host displays job names.
- Organization repositories need a `GITLEAKS_LICENSE` secret for the Gitleaks
  action; confirm its current licensing terms. Public repositories generally do
  not need a licence.
- Dependency review and SARIF uploads need the host's dependency graph and code
  scanning features. On private repositories this requires GitHub Advanced
  Security; enable dependency graph, secret scanning, and code scanning there.
- Dependabot must be enabled for private repositories; public repositories
  enable it by default but still need permission to open pull requests.
- The Trivy step uses `ignore-unfixed: true`, so it reports only findings with a
  published fix. Decide and document an exception policy for unfixed
  HIGH/CRITICAL findings before treating the image scan as a complete gate.
- Tests start their own PGlite database; no PostgreSQL service container is
  needed in CI.

## Health, logs, and alerts

- `GET /api/health/live` is a dependency-free liveness check. Use it for
  container restarts.
- `GET /api/health/ready` validates required production configuration and runs
  `SELECT 1` against PostgreSQL. It returns `503` without exposing configuration
  values or database error details; use it to add/remove instances from service.
  Readiness calls the same config getters used by email, Google sign-in,
  advisor, storage, and malware scanning, so development-only local drivers or
  semantically invalid URLs cannot pass. It also requires production database
  TLS, finite connect/pool timeouts, a bounded connection pool, deliverable
  sender and contact addresses, and a valid verification rollout timestamp.
  Readiness does not call external providers; use synthetic email, advisor, and
  scan canaries to verify live reachability.
- The app writes one-line JSON logs to stdout/stderr. Error objects contribute
  only a safe error type/code; request bodies, headers, passwords, tokens,
  email addresses, user identifiers, document contents, and advisor prompts or
  answers are excluded.
- Next.js request failures are logged through `onRequestError`; OpenTelemetry
  exports server request spans to `OTEL_EXPORTER_OTLP_ENDPOINT`. Header-derived
  span attributes are disabled, and a processor strips query strings, fragments,
  token/credential keys, and exception details before export so emailed links
  cannot leak through traces. App events
  include `auth.login_failed`, `security.rate_limit_denied`,
  `security.rate_limit_store_failed`, `storage.upload_processing_failed`,
  `storage.document_download_failed`, health-check failures, and advisor events:
  `advisor.chat_success`, `advisor.chat_failed`, `advisor.route_failed`,
  `advisor.configuration_invalid`, `advisor.rate_limit_denied`,
  `advisor.usage_cap_denied`, and `advisor.usage_record_failed`.
- Advisor success and failure logs use only allowlisted fields: provider, model,
  outcome, latency, tool count, token counts, and estimated micro-USD cost.
  Track these fields as dashboard metrics to monitor spend, latency, tool use,
  and error mix without retaining student content.
- Configure the chosen collector/backend to retain logs and traces, alert on
  elevated 5xx spans, repeated authentication failures, rate-limit storage
  failures, document-processing failures, readiness failures, and missed
  backups. Add alerts for advisor configuration-invalid events, elevated
  provider auth/rate-limit/timeout/unavailable outcomes, failed usage writes,
  unusual daily cost counts, and sustained `advisor.chat_failed` or
  `advisor.route_failed` volume. Alert routing and dashboards are
  platform-specific and are not provisioned by this repository.
- Do not enable Prisma query/parameter logging in production. Keep log retention
  and access scoped to the operations team.
- Readiness gives its database probe three seconds. Production configuration
  validation requires finite PostgreSQL `connect_timeout` and `pool_timeout`
  values plus a bounded `connection_limit`. SMTP uses bounded
  connect/greeting/socket timeouts; the ClamAV scan timeout is 15 seconds. S3
  operations retry up to three times with five-second connection and
  fifteen-second socket timeouts. The advisor defaults to a 30-second provider
  call timeout with a 60-second route budget; re-evaluate both after measuring
  the chosen provider's p95 latency.

The rate limiter is shared through PostgreSQL and fails closed if its counter
cannot be updated, returning a short retry interval rather than permitting an
unlimited authentication or upload attempt. Advisor message and estimated-cost
caps use the same shared counters plus a metadata-only daily usage ledger;
confirm the configured per-user and global dollar limits with real pricing
before enabling traffic.

## Database, storage, and performance

Use a managed PostgreSQL 16+ service with TLS and a provider-supported pooler
when required. Bound application connections to the database's connection
budget with `connection_limit`, and set finite `connect_timeout` and
`pool_timeout` in `DATABASE_URL`; production readiness fails without them.
Do not add `pgbouncer=true` unless the provider's pooler requires it. The
application uses Prisma's per-process client; do not create a new client per
request. PGlite-based tests prove migration syntax and query behavior, not
provider TLS, roles/grants, pooling, failover, or concurrent load. Complete the
[managed PostgreSQL staging verification](STAGING-DATABASE-VERIFICATION.md)
before treating the database layer as production-ready.

Use private document and backup buckets, provider-side public access blocks,
TLS-only policies, least-privilege identities, encryption, and lifecycle
retention. The app proxies every private document read after checking session,
workspace eligibility, and ownership; never configure public object URLs or
shared caching. Keep ClamAV on a private network and fail uploads closed if it
is unavailable. See [FILE-OPERATIONS.md](FILE-OPERATIONS.md) for S3, scanning,
backup, and restore configuration.

Catalog result pages are paginated and indexed. The dashboard reuses its
deadline rows to compute the upcoming-deadline metric rather than issuing a
separate count query. There is intentionally no shared response cache for
student data. The current app has no raster `<img>` assets to optimize; icons
and fonts are locally bundled.

The dashboard change removes one redundant query; no before/after production
latency benchmark is available. Use exported request spans and a synthetic
non-production load test to establish deployment-specific budgets before
increasing concurrency.

## Backups, recovery, and deployment gates

Schedule `npm run db:backup` from a restricted job runner using the production
database and storage credentials. Configure backup lifecycle retention and
alerts for missed or failed runs. Restore only to isolated recovery targets
using `npm run db:restore`, then verify document ownership and bytes through
authenticated routes. See the tested local procedures and production-drill
requirements in [FILE-OPERATIONS.md](FILE-OPERATIONS.md).

Before production traffic, verify the real hosting provider's environment
secrets, HTTPS/domain, PostgreSQL connectivity and pool limits, bucket access
policies, ClamAV availability/signatures, SMTP delivery, telemetry export and
alerts, scheduled backups, restore drill, and representative concurrent-user
load. For the AI Advisor, also verify a real provider response, model
availability, actual token billing, fallback behavior during an outage, and the
provider's data-retention/training policy. Prefer a zero-retention agreement and
record the configured pricing used for cost caps. The repository CI and
PGlite/injected-provider tests do not substitute for those external checks.
