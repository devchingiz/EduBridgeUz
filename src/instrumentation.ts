import { registerOTel } from "@vercel/otel";
import type { Instrumentation } from "next";

import { logError } from "@/lib/observability/logger";
import { RedactingSpanProcessor } from "@/lib/observability/redacting-span-processor";

export function register(): void {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim()
  ) {
    registerOTel({
      serviceName: "edubridge",
      // Do not copy headers such as Referer into root spans; token links would
      // leak through telemetry even with the processor below.
      attributesFromHeaders: {},
      spanProcessors: [new RedactingSpanProcessor(), "auto"],
    });
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
