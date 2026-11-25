/**
 * Pure guards for the destructive restore command. Kept separate from the
 * provider I/O in `restore.mjs` so they can be exercised without live
 * infrastructure. Application-side checks cannot prove that two hostnames
 * resolve to different databases; provider IAM separation is still required.
 */

export function parseDatabaseIdentity(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("A PostgreSQL URL is required.");
  }

  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("The PostgreSQL URL is malformed.");
  }

  const protocol = url.protocol.replace(/:$/, "").toLowerCase();
  if (protocol !== "postgresql" && protocol !== "postgres") {
    throw new Error("Restore targets must use PostgreSQL.");
  }

  const hostname = url.hostname.toLowerCase();
  const port = url.port || "5432";
  let database;
  try {
    database = decodeURIComponent(
      url.pathname.replace(/^\//, "").replace(/\/$/, ""),
    );
  } catch {
    throw new Error("The PostgreSQL database name is malformed.");
  }
  if (!database) throw new Error("The PostgreSQL database name is required.");

  return {
    protocol: "postgresql",
    hostname,
    port,
    database,
    identity: `postgresql://${hostname}:${port}/${database}`,
  };
}

/**
 * `pg_restore --clean` destroys objects in its target. Require an explicit
 * target database name and an identity that differs from the configured
 * production connection, including equivalent URL spellings.
 */
export function assertRestoreTargetIsIsolated({
  databaseUrl,
  restoreUrl,
  targetName,
}) {
  const production = parseDatabaseIdentity(databaseUrl);
  const target = parseDatabaseIdentity(restoreUrl);

  if (typeof targetName !== "string" || targetName.trim() !== target.database) {
    throw new Error(
      "RESTORE_TARGET_NAME must exactly match the recovery database name.",
    );
  }
  if (production.identity === target.identity) {
    throw new Error(
      "RESTORE_DATABASE_URL must target a separate recovery database, not DATABASE_URL.",
    );
  }
  if (production.database === target.database) {
    throw new Error(
      "The recovery database name must differ from the production database name.",
    );
  }

  return target;
}

/** The restore must never overwrite an existing document object. */
export async function assertEmptyRestoreBucket(listObjects, bucket) {
  if (typeof bucket !== "string" || !bucket.trim()) {
    throw new Error("A destination document bucket is required.");
  }
  const result = await listObjects(bucket);
  const count = result?.KeyCount ?? result?.Contents?.length ?? 0;
  if (count > 0 || result?.IsTruncated) {
    throw new Error(
      "RESTORE_DOCUMENT_BUCKET must be empty before restoring documents.",
    );
  }
}
