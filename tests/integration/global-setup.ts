import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

const HOST = "127.0.0.1";
const DATA_DIR = path.resolve(process.cwd(), ".data", "pglite-test");
const URL_FILE = path.resolve(process.cwd(), ".data", "test-db.json");

let server: ChildProcess | undefined;

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen(0, HOST, () => {
      const address = probe.address();
      if (!address || typeof address === "string") {
        probe.close();
        reject(new Error("Could not allocate a test database port."));
        return;
      }
      const { port } = address;
      probe.close(() => resolve(port));
    });
  });
}

function waitForReady(child: ChildProcess, timeoutMs = 60_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(
        new Error(`The test database did not start within ${timeoutMs}ms.`),
      );
    }, timeoutMs);

    const onData = (chunk: Buffer) => {
      if (chunk.toString().includes("listening on postgresql://")) {
        cleanup();
        resolve();
      }
    };
    const onExit = (code: number | null) => {
      cleanup();
      reject(new Error(`The test database exited early with code ${code}.`));
    };
    const cleanup = () => {
      clearTimeout(timer);
      child.stdout?.off("data", onData);
      child.off("exit", onExit);
    };

    child.stdout?.on("data", onData);
    child.once("exit", onExit);
  });
}

/**
 * Starts a throwaway PGlite instance for the integration suite.
 *
 * PGlite is a single-session PostgreSQL: prepared statements survive client
 * disconnects, so reusing a long-running instance eventually collides with
 * Prisma's `s0`-style statement names. A fresh process per run keeps the suite
 * repeatable, and a separate data directory keeps it away from `npm run dev`.
 */
export async function setup() {
  fs.mkdirSync(path.dirname(URL_FILE), { recursive: true });

  const port = await findFreePort();
  // `pgbouncer=true` disables Prisma's named prepared statements. PGlite keeps
  // them for the life of the single server session, so a second test file's
  // client would otherwise collide on names such as `s0`.
  const databaseUrl = `postgresql://postgres:postgres@${HOST}:${port}/postgres?schema=public&pgbouncer=true`;

  server = spawn(process.execPath, ["scripts/dev-db.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PGLITE_HOST: HOST,
      PGLITE_PORT: String(port),
      PGLITE_DATA_DIR: DATA_DIR,
      PGLITE_MAX_CONNECTIONS: "10",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  server.stdout?.on("data", (chunk: Buffer) => process.stdout.write(chunk));
  server.stderr?.on("data", (chunk: Buffer) => process.stderr.write(chunk));

  server.once("exit", (code) => {
    if (code !== null && code !== 0) {
      console.error(`[test-db] exited early with code ${code}`);
    }
  });

  await waitForReady(server);

  execFileSync(
    process.execPath,
    [
      path.join("node_modules", "prisma", "build", "index.js"),
      "migrate",
      "deploy",
    ],
    {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: databaseUrl },
    },
  );

  // Workers read this in `tests/integration/setup-env.ts` before Prisma loads.
  fs.writeFileSync(URL_FILE, JSON.stringify({ databaseUrl }), "utf8");
  process.env.DATABASE_URL = databaseUrl;
}

export async function teardown() {
  fs.rmSync(URL_FILE, { force: true });

  if (!server || server.exitCode !== null) return;

  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      server?.kill();
      resolve();
    }, 5_000);

    server?.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });

    server?.kill();
  });
}
