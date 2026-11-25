/**
 * Guards for the staging verification workflow.
 *
 * These checks are intentionally conservative: they never connect to a
 * database, never print URL values, and require explicit confirmation before a
 * caller is allowed to touch a staging instance. Provider IAM and network
 * separation are still required; parsing a URL cannot prove isolation.
 */

import { parseDatabaseIdentity } from "./restore-guards.mjs";

const CERT_VALIDATING_SSL_MODES = new Set(["verify-ca", "verify-full"]);

function decodePart(value) {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

function positiveInteger(url, name) {
  const raw = url.searchParams.get(name);
  if (raw === null || raw.trim() === "") return false;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 && value <= 2_147_483_647;
}

function parseUrl(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required.`);
  }

  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(`${name} must be a valid PostgreSQL URL.`);
  }

  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error(`${name} must use PostgreSQL.`);
  }

  let database;
  try {
    database = decodeURIComponent(
      url.pathname.replace(/^\//, "").replace(/\/$/, ""),
    );
  } catch {
    throw new Error(`${name} has a malformed database name.`);
  }
  if (!url.hostname || !database) {
    throw new Error(`${name} must include a host and database.`);
  }

  return url;
}

/** Returns URL facts without usernames, passwords, or query-string values. */
export function inspectStagingUrl(value, name) {
  const url = parseUrl(value, name);
  const identity = parseDatabaseIdentity(value).identity;
  const sslMode = url.searchParams.get("sslmode")?.toLowerCase() ?? null;
  const channelBinding =
    url.searchParams.get("channel_binding")?.toLowerCase() ?? null;

  return {
    hostname: url.hostname.replace(/^\[|\]$/g, "").toLowerCase(),
    port: url.port || "5432",
    database: decodeURIComponent(
      url.pathname.replace(/^\//, "").replace(/\/$/, ""),
    ),
    identity,
    sslMode,
    channelBinding,
    certValidatingTls:
      sslMode !== null && CERT_VALIDATING_SSL_MODES.has(sslMode),
    tlsEnabled: sslMode === "require" || CERT_VALIDATING_SSL_MODES.has(sslMode),
    channelBindingDisabled: channelBinding === "disable",
    connectTimeout: positiveInteger(url, "connect_timeout"),
    poolTimeout: positiveInteger(url, "pool_timeout"),
    connectionLimit: positiveInteger(url, "connection_limit"),
    pgbouncer: url.searchParams.get("pgbouncer") === "true",
  };
}

/**
 * Fail before connecting unless the operator has explicitly identified the
 * target as staging and supplied separate, TLS-protected endpoints.
 */
export function assertStagingVerificationAllowed({
  pooledUrl,
  directUrl,
  forbiddenIdentity,
  confirm,
  pooledHostMarker,
} = {}) {
  if (confirm !== "STAGING") {
    throw new Error(
      "Set STAGING_CONFIRM=STAGING before using staging verification.",
    );
  }

  const pooled = inspectStagingUrl(pooledUrl, "STAGING_DATABASE_URL");
  const direct = inspectStagingUrl(directUrl, "STAGING_DATABASE_URL_DIRECT");

  if (!pooled.certValidatingTls || !direct.certValidatingTls) {
    throw new Error(
      "Staging URLs must use sslmode=verify-ca or sslmode=verify-full.",
    );
  }
  if (
    !pooled.connectTimeout ||
    !pooled.poolTimeout ||
    !pooled.connectionLimit
  ) {
    throw new Error(
      "The pooled staging URL must set positive connect_timeout, pool_timeout, and connection_limit values.",
    );
  }
  if (!direct.connectTimeout) {
    throw new Error(
      "The direct staging URL must set a positive connect_timeout.",
    );
  }
  if (pooled.channelBindingDisabled || direct.channelBindingDisabled) {
    throw new Error("Staging URLs must not disable channel_binding.");
  }

  if (typeof forbiddenIdentity === "string" && forbiddenIdentity.trim()) {
    const forbidden = forbiddenIdentity.trim().toLowerCase();
    if (
      forbidden === pooled.identity.toLowerCase() ||
      forbidden === direct.identity.toLowerCase()
    ) {
      throw new Error(
        "Staging endpoints match the explicitly configured forbidden database identity.",
      );
    }
  }

  const marker =
    typeof pooledHostMarker === "string" && pooledHostMarker.trim()
      ? pooledHostMarker.trim()
      : null;
  if (marker) {
    if (!pooled.hostname.includes(marker) || direct.hostname.includes(marker)) {
      throw new Error(
        "Pooled and direct endpoints do not match the configured provider host marker.",
      );
    }
  }

  return { pooled, direct };
}

/** A replay must start from an empty database unless explicitly overridden. */
export function assertEmptyStagingDatabase({
  userTables,
  migrationRows,
  allowExisting,
}) {
  if (!Number.isInteger(userTables) || !Number.isInteger(migrationRows)) {
    throw new Error("Staging database state could not be determined.");
  }
  if (allowExisting === "YES") return;
  if (userTables > 0 || migrationRows > 0) {
    throw new Error(
      "Migration replay requires a newly created empty database. Set STAGING_ALLOW_EXISTING=YES only if reuse is intentional.",
    );
  }
}

/** Compares applied migration names with the committed migration directory. */
export function assessMigrationHistory(actual, expected) {
  if (!Array.isArray(actual) || !Array.isArray(expected)) {
    throw new Error("Migration history could not be compared.");
  }

  const actualNames = new Set(actual.map((row) => row.migrationName));
  const expectedNames = new Set(expected);
  const missing = expected.filter((name) => !actualNames.has(name));
  const extra = actual
    .map((row) => row.migrationName)
    .filter((name) => !expectedNames.has(name));
  const unsuccessful = actual.filter(
    (row) => row.finished !== true || row.rolledBack === true,
  );

  return {
    complete:
      missing.length === 0 && extra.length === 0 && unsuccessful.length === 0,
    missing,
    extra,
    unsuccessful: unsuccessful.map((row) => row.migrationName),
  };
}

/**
 * Removes raw URLs, decoded usernames/passwords, and libpq-shaped URLs from
 * child-process output. Secret values are never included in error messages.
 */
export function redactConnectionDetails(text, urls = []) {
  const secrets = new Set();
  for (const value of urls) {
    if (typeof value !== "string" || !value.trim()) continue;
    secrets.add(value.trim());
    try {
      const url = new URL(value.trim());
      const username = decodePart(url.username);
      const password = decodePart(url.password);
      if (username) secrets.add(username);
      if (password) secrets.add(password);
    } catch {
      // The raw value is still redacted.
    }
  }

  let output = String(text);
  for (const secret of [...secrets].sort((a, b) => b.length - a.length)) {
    output = output.split(secret).join("[redacted]");
  }
  return output.replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/gi, "[redacted-url]");
}
