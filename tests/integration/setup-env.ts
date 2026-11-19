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
