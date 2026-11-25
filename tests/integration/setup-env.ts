import fs from "node:fs";
import path from "node:path";

/**
 * Runs inside each test worker before test modules load. The global setup
 * writes the throwaway database URL after starting PGlite on a free port.
 */
const urlFile = path.resolve(process.cwd(), ".data", "test-db.json");

if (fs.existsSync(urlFile)) {
  const { databaseUrl } = JSON.parse(fs.readFileSync(urlFile, "utf8")) as {
    databaseUrl: string;
  };
  process.env.DATABASE_URL = databaseUrl;
}

// Fixed rollout clock for grace-period assertions. Production uses the value
// from deployment configuration; tests must never derive it from "now".
process.env.EMAIL_VERIFICATION_ENFORCEMENT_START ??= "2026-01-01T00:00:00.000Z";

// Dedicated, stable MFA seed key. Production readiness requires an explicit
// value; tests use a fixed one so encrypted secrets remain decryptable.
process.env.MFA_ENCRYPTION_KEY ??=
  "test-mfa-encryption-key-at-least-32-characters";
