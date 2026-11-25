import { describe, expect, it } from "vitest";

import {
  redactSpanName,
  redactTelemetryAttributes,
} from "@/lib/observability/redact-telemetry";
import { RedactingSpanProcessor } from "@/lib/observability/redacting-span-processor";

describe("telemetry redaction", () => {
  it("removes token-bearing query strings from URLs and span names", () => {
    expect(
      redactTelemetryAttributes({
        "http.target": "/verify-email?token=raw-secret",
        "http.url": "https://edubridge.example/reset-password?token=raw-secret",
        "http.route": "/verify-email",
        "http.method": "GET",
      }),
    ).toEqual({
      "http.target": "/verify-email?[REDACTED]",
      "http.url": "https://edubridge.example/reset-password?[REDACTED]",
      "http.route": "/verify-email",
      "http.method": "GET",
    });
    expect(redactSpanName("fetch GET /api?token=raw-secret")).toBe(
      "fetch GET /api?[REDACTED]",
    );
  });

  it("drops sensitive keys and redacts exception details", () => {
    const redacted = redactTelemetryAttributes({
      authorization: "Bearer secret",
      sessionCookie: "edubridge_session=secret",
      "exception.message": "failed for token=raw-secret",
      "exception.stacktrace": "stack",
      tag: "verify-email",
    });

    expect(redacted).toEqual({
      "exception.message": "[REDACTED]",
      "exception.stacktrace": "[REDACTED]",
      tag: "verify-email",
    });
  });

  it("mutates spans before the default exporter sees them", () => {
    const span = {
      name: "GET /verify-email?token=raw-secret",
      attributes: {
        "http.target": "/verify-email?token=raw-secret",
        "http.referer": "https://edubridge.example/?token=raw-secret",
        "http.method": "GET",
      },
      events: [
        {
          name: "exception",
          attributes: { "exception.message": "token=raw-secret" },
        },
      ],
    };

    new RedactingSpanProcessor().onEnd(span);

    expect(span.name).toBe("GET /verify-email?[REDACTED]");
    expect(span.attributes).toEqual({
      "http.target": "/verify-email?[REDACTED]",
      "http.referer": "https://edubridge.example/?[REDACTED]",
      "http.method": "GET",
    });
    expect(span.events[0].attributes).toEqual({
      "exception.message": "[REDACTED]",
    });
    expect(JSON.stringify(span)).not.toContain("raw-secret");
  });
});
