/**
 * Managed PostgreSQL staging verification helper.
 *
 * It never invents or prints credentials, never connects without an explicit
 * staging confirmation, uses the direct endpoint for Prisma CLI/SQL checks,
 * and never runs `prisma db push` or a destructive reset. The default mode is
 * read-only; applying migrations requires separate confirmation.
 */

import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  assertEmptyStagingDatabase,
  assertStagingVerificationAllowed,
  redactConnectionDetails,
  assessMigrationHistory,
} from "./staging-db-guards.mjs";

const MODES = new Set(["preflight", "check", "migrate", "health"]);
const CRITICAL_TABLES = [
  "User",
  "Session",
  "AuthToken",
  "Application",
  "StudentDocument",
  "University",
  "CatalogFieldFact",
  "HomepageContent",
  "MfaRecoveryCode",
];
const REQUIRED_CHECK_CONSTRAINTS = [
  "Application_progress_check",
  "StudentDocument_sizeBytes_check",
];

function stagingInput() {
  return {
    pooledUrl: process.env.STAGING_DATABASE_URL,
    directUrl: process.env.STAGING_DATABASE_URL_DIRECT,
    forbiddenIdentity: process.env.STAGING_FORBIDDEN_IDENTITY,
    confirm: process.env.STAGING_CONFIRM,
    pooledHostMarker: process.env.STAGING_POOLED_HOST_MARKER,
  };
}

function secretValues() {
  return [
    process.env.STAGING_DATABASE_URL,
    process.env.STAGING_DATABASE_URL_DIRECT,
    process.env.DATABASE_URL,
    process.env.STAGING_APP_URL,
  ];
}

function printJson(value) {
  console.log(
    JSON.stringify(
      value,
      (_key, item) => (typeof item === "bigint" ? item.toString() : item),
      2,
    ),
  );
}

function expectedMigrations() {
  const root = path.resolve(process.cwd(), "prisma", "migrations");
  if (!existsSync(root)) {
    throw new Error("prisma/migrations is missing.");
  }
  return readdirSync(root, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        existsSync(path.join(root, entry.name, "migration.sql")),
    )
    .map((entry) => entry.name)
    .sort();
}

async function connect(directUrl) {
  const { PrismaClient } = await import("@prisma/client");
  const client = new PrismaClient({
    datasources: { db: { url: directUrl } },
  });
  await client.$connect();
  return client;
}

async function collectState(client) {
  const serverRows = await client.$queryRawUnsafe(`
    SELECT
      current_setting('server_version') AS "serverVersion",
      version() AS "version",
      current_database() AS "database",
      current_user AS "role",
      current_setting('max_connections')::int AS "maxConnections",
      ssl AS "tls",
      version AS "tlsVersion",
      cipher AS "cipher"
    FROM pg_stat_ssl
    WHERE pid = pg_backend_pid()
  `);

  const roleRows = await client.$queryRawUnsafe(`
    SELECT
      rolname AS "role",
      rolsuper AS "superuser",
      rolcreatedb AS "createDb",
      rolcreaterole AS "createRole",
      rolreplication AS "replication",
      rolbypassrls AS "bypassRls",
      rolconnlimit AS "connectionLimit"
    FROM pg_roles
    WHERE rolname = current_user
  `);

  const privilegeRows = await client.$queryRawUnsafe(`
    SELECT
      has_database_privilege(current_database(), current_user, 'CONNECT') AS "connect",
      has_schema_privilege('public', current_user, 'USAGE') AS "schemaUsage",
      has_schema_privilege('public', current_user, 'CREATE') AS "schemaCreate"
  `);

  const shapeRows = await client.$queryRawUnsafe(`
    SELECT
      (
        SELECT count(*)::int
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ) AS "tables",
      (
        SELECT count(*)::int
        FROM pg_catalog.pg_type t
        JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typtype = 'e'
      ) AS "enums",
      (
        SELECT count(*)::int
        FROM pg_catalog.pg_indexes
        WHERE schemaname = 'public'
      ) AS "indexes",
      (
        SELECT count(*)::int
        FROM information_schema.table_constraints
        WHERE table_schema = 'public' AND constraint_type = 'FOREIGN KEY'
      ) AS "foreignKeys"
  `);

  const migrationTableRows = await client.$queryRawUnsafe(`
    SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS "present"
  `);
  const hasMigrationTable =
    migrationTableRows.length > 0 && migrationTableRows[0].present === true;
  const migrationRows = hasMigrationTable
    ? await client.$queryRawUnsafe(`
        SELECT
          migration_name AS "migrationName",
          finished_at IS NOT NULL AS "finished",
          COALESCE(rolled_back_at IS NOT NULL, false) AS "rolledBack",
          applied_steps_count AS "appliedStepsCount"
        FROM "_prisma_migrations"
        ORDER BY migration_name
      `)
    : [];

  const tableChecks = await client.$queryRawUnsafe(
    `SELECT ${CRITICAL_TABLES.map(
      (table, index) => `to_regclass($${index + 1}) IS NOT NULL AS "${table}"`,
    ).join(", ")}`,
    ...CRITICAL_TABLES.map((table) => `public."${table}"`),
  );

  const checkConstraintRows = await client.$queryRawUnsafe(`
    SELECT conname AS "name"
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
      AND contype = 'c'
      AND conname IN ('Application_progress_check', 'StudentDocument_sizeBytes_check')
  `);
  const presentCheckConstraints = checkConstraintRows.map((row) => row.name);

  return {
    server: serverRows[0] ?? null,
    role: roleRows[0] ?? null,
    privileges: privilegeRows[0] ?? null,
    shape: shapeRows[0] ?? null,
    criticalTables: Object.fromEntries(
      CRITICAL_TABLES.map((table) => [table, tableChecks[0]?.[table] === true]),
    ),
    missingCheckConstraints: REQUIRED_CHECK_CONSTRAINTS.filter(
      (name) => !presentCheckConstraints.includes(name),
    ),
    migrations: migrationRows.map((row) => ({
      migrationName: row.migrationName,
      finished: row.finished === true,
      rolledBack: row.rolledBack === true,
      appliedStepsCount: row.appliedStepsCount,
    })),
    expectedMigrations: expectedMigrations(),
  };
}

async function runPrisma(args, directUrl) {
  const cli = path.resolve(
    process.cwd(),
    "node_modules",
    "prisma",
    "build",
    "index.js",
  );
  if (!existsSync(cli)) {
    throw new Error("Prisma CLI is not installed. Run `npm ci` first.");
  }

  const child = spawn(process.execPath, [cli, ...args], {
    env: { ...process.env, DATABASE_URL: directUrl },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    process.stdout.write(redactConnectionDetails(chunk, secretValues()));
  });
  child.stderr.on("data", (chunk) => {
    process.stderr.write(redactConnectionDetails(chunk, secretValues()));
  });

  await new Promise((resolve, reject) => {
    let settled = false;
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
    child.once("close", (code, signal) => {
      if (settled) return;
      settled = true;
      if (signal) reject(new Error(`Prisma ${args[0]} was terminated.`));
      else if (code !== 0)
        reject(new Error(`Prisma ${args[0]} exited with code ${code}.`));
      else resolve();
    });
  });
}

function parseAppUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("STAGING_APP_URL is required for health verification.");
  }
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("STAGING_APP_URL must be a valid HTTP(S) URL.");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("STAGING_APP_URL must use HTTP or HTTPS.");
  }
  if (url.username || url.password) {
    throw new Error("STAGING_APP_URL must not contain credentials.");
  }
  return url;
}

async function checkHealth() {
  if (process.env.STAGING_CONFIRM !== "STAGING") {
    throw new Error(
      "Set STAGING_CONFIRM=STAGING before using staging verification.",
    );
  }
  const base = parseAppUrl(process.env.STAGING_APP_URL);
  const paths = ["/api/health/live", "/api/health/ready"];
  const results = [];

  for (const requestPath of paths) {
    const target = new URL(requestPath, base).toString();
    try {
      const response = await fetch(target, {
        redirect: "manual",
        signal: AbortSignal.timeout(10_000),
      });
      results.push({
        path: requestPath,
        status: response.status,
        ok: response.ok,
      });
    } catch (error) {
      results.push({
        path: requestPath,
        ok: false,
        error: redactConnectionDetails(
          error instanceof Error ? error.message : String(error),
          secretValues(),
        ),
      });
    }
  }

  printJson(results);
  if (results.some((result) => !result.ok)) process.exitCode = 1;
}

async function main() {
  const mode = (process.argv[2] ?? "check").toLowerCase();
  if (!MODES.has(mode)) {
    throw new Error(
      `Unknown staging verification mode. Use one of: ${[...MODES].join(", ")}.`,
    );
  }

  if (mode === "health") {
    await checkHealth();
    return;
  }

  const { pooled, direct } = assertStagingVerificationAllowed(stagingInput());
  const directUrl = process.env.STAGING_DATABASE_URL_DIRECT.trim();

  if (mode === "migrate" && process.env.STAGING_CONFIRM_MIGRATE !== "MIGRATE") {
    throw new Error(
      "Set STAGING_CONFIRM_MIGRATE=MIGRATE before applying migrations to staging.",
    );
  }

  if (mode === "preflight") {
    printJson({ pooled, direct });
    return;
  }

  const client = await connect(directUrl);
  try {
    const state = await collectState(client);

    if (mode === "check") {
      printJson({
        mode,
        endpoints: { pooled, direct },
        ...state,
        migrationHistory: state.migrations.length
          ? assessMigrationHistory(state.migrations, state.expectedMigrations)
          : null,
      });
      return;
    }

    assertEmptyStagingDatabase({
      userTables: state.shape?.tables ?? -1,
      migrationRows: state.migrations.length,
      allowExisting: process.env.STAGING_ALLOW_EXISTING,
    });
    console.error(
      "Running Prisma validation against the direct staging endpoint.",
    );
    await runPrisma(["validate"], directUrl);
    console.error("Applying the committed migration history to staging.");
    await runPrisma(["migrate", "deploy"], directUrl);
    console.error("Reading migration status from the direct staging endpoint.");
    await runPrisma(["migrate", "status"], directUrl);

    const after = await collectState(client);
    const history = assessMigrationHistory(
      after.migrations,
      after.expectedMigrations,
    );
    printJson({
      mode,
      endpoints: { pooled, direct },
      server: after.server,
      role: after.role,
      privileges: after.privileges,
      shape: after.shape,
      criticalTables: after.criticalTables,
      missingCheckConstraints: after.missingCheckConstraints,
      appliedMigrations: after.migrations.length,
      migrationHistory: history,
    });
    if (!history.complete) process.exitCode = 1;
  } finally {
    await client.$disconnect();
  }
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(redactConnectionDetails(message, secretValues()));
    process.exitCode = 1;
  });
}
