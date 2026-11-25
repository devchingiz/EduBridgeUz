/**
 * `prisma db push` can silently rewrite a schema, so it is limited to local
 * loopback development. This guard never connects to a database; it only parses
 * the configured URL and refuses unsafe environments before delegating to the
 * installed Prisma CLI.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { parseDatabaseIdentity } from "./restore-guards.mjs";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function assertLocalDatabasePushAllowed({
  databaseUrl = process.env.DATABASE_URL,
  nodeEnv = process.env.NODE_ENV,
} = {}) {
  if (nodeEnv === "production") {
    throw new Error(
      "prisma db push is disabled in production. Use `npm run db:migrate` (prisma migrate deploy) from a restricted release job.",
    );
  }

  let identity;
  try {
    identity = parseDatabaseIdentity(databaseUrl);
  } catch {
    throw new Error(
      "DATABASE_URL must be a valid PostgreSQL URL before running prisma db push.",
    );
  }

  const hostname = identity.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error(
      "prisma db push is limited to a local loopback database. Use `npm run db:migrate` for non-local PostgreSQL instances.",
    );
  }

  return identity;
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  try {
    assertLocalDatabasePushAllowed();
    const prismaCli = path.resolve(
      process.cwd(),
      "node_modules",
      "prisma",
      "build",
      "index.js",
    );
    if (!existsSync(prismaCli)) {
      throw new Error("Prisma CLI is not installed. Run `npm ci` first.");
    }

    const child = spawn(
      process.execPath,
      [prismaCli, "db", "push", ...process.argv.slice(2)],
      { stdio: "inherit" },
    );
    child.on("error", (error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
    child.on("exit", (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }
      process.exitCode = code ?? 1;
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
