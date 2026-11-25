import { db } from "@/lib/db";
import { logError } from "@/lib/observability/logger";
import { productionReadinessIssues } from "@/lib/config/readiness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const DATABASE_CHECK_TIMEOUT_MS = 3_000;

const unavailable = () =>
  Response.json(
    { status: "unavailable" },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );

export async function GET(): Promise<Response> {
  const issues = productionReadinessIssues();
  if (issues.length > 0) {
    logError("health.configuration_invalid", null, {
      issueCount: issues.length,
      status: "unavailable",
    });
    return unavailable();
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Database readiness check timed out.")),
          DATABASE_CHECK_TIMEOUT_MS,
        );
      }),
    ]);
  } catch (error) {
    logError("health.database_unavailable", error, { status: "unavailable" });
    return unavailable();
  } finally {
    if (timeout) clearTimeout(timeout);
  }

  return Response.json(
    { status: "ok" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
