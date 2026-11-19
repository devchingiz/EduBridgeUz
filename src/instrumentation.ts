import { registerOTel } from "@vercel/otel";
import type { Instrumentation } from "next";

import { logError } from "@/lib/observability/logger";

export function register(): void {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim()
  ) {
    registerOTel({ serviceName: "edubridge" });
  }
}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  logError("http.request_failed", error, {
    method: request.method,
    route: context.routePath,
    routeType: context.routeType,
  });
};
