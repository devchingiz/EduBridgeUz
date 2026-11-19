// Local development database: PGlite (PostgreSQL compiled to WebAssembly)
// exposed over the PostgreSQL wire protocol.
//
// This gives development and integration tests the same SQL semantics as
// production PostgreSQL without a system installation. It is a development
// tool only; production uses a managed PostgreSQL instance.

import fs from "node:fs";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const port = Number(process.env.PGLITE_PORT ?? 5432);
const host = process.env.PGLITE_HOST ?? "127.0.0.1";
const dataDir = path.resolve(
  process.cwd(),
  process.env.PGLITE_DATA_DIR ?? ".data/pglite",
);

fs.mkdirSync(dataDir, { recursive: true });

const db = await PGlite.create({ dataDir });
const server = new PGLiteSocketServer({
  db,
  port,
  host,
  // PGlite serialises queries internally, so allowing several clients is safe.
  // Prisma opens a small pool; the upstream default of 1 would reject it.
  maxConnections: Number(process.env.PGLITE_MAX_CONNECTIONS ?? 10),
});

await server.start();

console.log(
  `EduBridge local PostgreSQL (PGlite) listening on postgresql://postgres:postgres@${host}:${port}/postgres`,
);
console.log(`Data directory: ${dataDir}`);

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\nReceived ${signal}, shutting down local database...`);
  try {
    await server.stop();
  } finally {
    await db.close();
    process.exit(0);
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
