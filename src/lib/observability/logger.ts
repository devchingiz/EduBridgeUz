type LogFields = Record<string, string | number | boolean | undefined>;

const SAFE_FIELDS = new Set([
  "action",
  "completionTokens",
  "digest",
  "entityType",
  "estimatedCostMicros",
  "issueCount",
  "latencyMs",
  "method",
  "model",
  "outcome",
  "provider",
  "promptTokens",
  "reason",
  "route",
  "routeType",
  "scope",
  "status",
  "statusCode",
  "tag",
  "toolCount",
]);

function safeToken(value: string): string {
  return value.replace(/[^A-Za-z0-9_./:-]/g, "").slice(0, 128);
}

function serialize(
  level: "info" | "warn" | "error",
  event: string,
  fields: LogFields,
  error?: unknown,
): string {
  const record: Record<string, string | number | boolean> = {
    timestamp: new Date().toISOString(),
    level,
    event: /^[a-z0-9_.-]{1,80}$/.test(event) ? event : "invalid_event",
  };

  for (const [key, value] of Object.entries(fields)) {
    if (!SAFE_FIELDS.has(key) || value === undefined) continue;
    if (typeof value === "number") {
      if (Number.isFinite(value)) record[key] = value;
      continue;
    }
    if (typeof value === "boolean") {
      record[key] = value;
      continue;
    }
    let safeInput = value;
    if (key === "route") {
      safeInput = safeInput.split(/[?#]/, 1)[0];
    }
    const safeValue = safeToken(safeInput);
    if (safeValue) record[key] = safeValue;
  }

  if (error && typeof error === "object") {
    const errorRecord = error as { name?: unknown; code?: unknown };
    if (typeof errorRecord.name === "string") {
      const errorType = safeToken(errorRecord.name);
      if (errorType) record.errorType = errorType;
    }
    if (
      typeof errorRecord.code === "string" &&
      /^[A-Za-z0-9_]{1,32}$/.test(errorRecord.code)
    ) {
      record.errorCode = errorRecord.code;
    }
  }

  return JSON.stringify(record);
}

export function logInfo(event: string, fields: LogFields = {}): void {
  console.info(serialize("info", event, fields));
}

export function logWarn(event: string, fields: LogFields = {}): void {
  console.warn(serialize("warn", event, fields));
}

export function logError(
  event: string,
  error: unknown,
  fields: LogFields = {},
): void {
  console.error(serialize("error", event, fields, error));
}
