const REDACTED = "[REDACTED]";

const SENSITIVE_KEY =
  /token|secret|password|passwd|authorization|cookie|api[-_]?key|credential|sessionid|bearer/i;

const URL_KEYS = new Set([
  "http.target",
  "http.url",
  "url.full",
  "url.query",
  "url.path",
  "http.referer",
  "referer",
  "next.url",
]);

const ERROR_KEYS = new Set([
  "exception.message",
  "exception.stacktrace",
  "error.message",
  "error.stack",
]);

function redactUrl(value: string): string {
  const index = value.search(/[?#]/);
  return index === -1 ? value : `${value.slice(0, index)}?${REDACTED}`;
}

/** Removes query strings and fragments, which may carry emailed link tokens. */
export function redactSpanName(name: string): string {
  return redactUrl(name);
}

export function redactTelemetryAttributes(
  attributes: Record<string, unknown>,
): Record<string, unknown> {
  const safe: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(attributes)) {
    if (SENSITIVE_KEY.test(key)) continue;

    if (URL_KEYS.has(key)) {
      if (typeof value === "string") safe[key] = redactUrl(value);
      continue;
    }

    if (ERROR_KEYS.has(key)) {
      safe[key] = REDACTED;
      continue;
    }

    safe[key] = value;
  }

  return safe;
}
