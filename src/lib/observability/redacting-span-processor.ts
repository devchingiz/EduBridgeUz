import {
  redactSpanName,
  redactTelemetryAttributes,
} from "@/lib/observability/redact-telemetry";

type TelemetryEvent = {
  name: string;
  attributes?: Record<string, unknown>;
};

type TelemetrySpan = {
  name: string;
  attributes: Record<string, unknown>;
  events?: readonly TelemetryEvent[];
};

/**
 * Runs before the default exporter. It mutates the span in place so token-bearing
 * URLs and exception details never leave the process, regardless of collector
 * configuration. Keeping header-derived attributes disabled in instrumentation
 * prevents a second path for referrer tokens.
 */
export class RedactingSpanProcessor {
  onStart(): void {}

  onEnd(span: unknown): void {
    const candidate = span as TelemetrySpan;
    if (!candidate || typeof candidate !== "object") return;

    candidate.name = redactSpanName(candidate.name);
    candidate.attributes = redactTelemetryAttributes(
      candidate.attributes ?? {},
    );

    for (const event of candidate.events ?? []) {
      const mutable = event as { attributes?: Record<string, unknown> };
      if (mutable.attributes) {
        mutable.attributes = redactTelemetryAttributes(mutable.attributes);
      }
    }
  }

  async forceFlush(): Promise<void> {}

  async shutdown(): Promise<void> {}
}
