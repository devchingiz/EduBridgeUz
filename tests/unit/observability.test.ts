import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { productionReadinessIssues } from "@/lib/config/readiness";
import { productionConfigurationIssues } from "@/lib/env";
import { logError, logInfo, logWarn } from "@/lib/observability/logger";
import { resetPrivateObjectStorageForTests } from "@/lib/workspace/object-storage";

const productionEnvironment: Record<string, string> = {
  NEXT_PUBLIC_APP_URL: "https://edubridge.example",
  DATABASE_URL:
    "postgresql://edubridge:password@db.example/edubridge?schema=public&sslmode=verify-full&connect_timeout=10&pool_timeout=10&connection_limit=10",
  AUTH_SECRET: "production-secret-value-that-is-at-least-32-characters",
  MFA_ENCRYPTION_KEY: "production-mfa-key-value-that-is-at-least-32-chars",
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
  EMAIL_TRANSPORT: "smtp",
  SMTP_HOST: "smtp.example.test",
  SMTP_PORT: "587",
  EMAIL_FROM: "EduBridge <no-reply@edubridge.com>",
  EMAIL_VERIFICATION_ENFORCEMENT_START: "2026-01-01T00:00:00.000Z",
  SECURITY_CONTACT_EMAIL: "security@edubridge.com",
  PRIVACY_CONTACT_EMAIL: "privacy@edubridge.com",
  STORAGE_REGION: "us-east-1",
  STORAGE_BUCKET: "edubridge-documents",
  STORAGE_BACKUP_BUCKET: "edubridge-backups",
  MALWARE_SCANNER_HOST: "clamav.internal",
  MALWARE_SCANNER_PORT: "3310",
  OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel.example.test",
  AI_PROVIDER: "openai",
  AI_API_KEY: "production-ai-key",
  AI_MODEL: "gpt-4.1-mini",
};

describe("production configuration and logging", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    for (const [key, value] of Object.entries(productionEnvironment)) {
      vi.stubEnv(key, value);
    }
    resetPrivateObjectStorageForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("accepts a complete production environment", () => {
    expect(productionConfigurationIssues()).toEqual([]);
  });

  it("reports invalid setting names without exposing configured values", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    vi.stubEnv("DATABASE_URL", "");

    const issues = productionConfigurationIssues();

    expect(issues).toContain("NEXT_PUBLIC_APP_URL");
    expect(issues).toContain("DATABASE_URL");
    expect(issues.join(" ")).not.toContain("password");
    expect(issues.join(" ")).not.toContain("localhost");
  });

  it("requires TLS, finite timeouts, and a bounded pool for the production database", () => {
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://edubridge:password@db.example/edubridge?sslmode=disable&connect_timeout=0&pool_timeout=-1&connection_limit=0",
    );

    const issues = productionConfigurationIssues();

    expect(issues).toContain("DATABASE_URL_TLS");
    expect(issues).toContain("DATABASE_URL_TIMEOUTS");
    expect(issues).toContain("DATABASE_URL_POOL");
    expect(issues.join(" ")).not.toContain("password");
    expect(issues.join(" ")).not.toContain("db.example");
  });

  it("serializes only allowlisted, redacted error metadata", () => {
    const output = vi.spyOn(console, "error").mockImplementation(() => {});
    logError("test.failure", new Error("private message and token"), {
      route: "/api/private?token=do-not-log",
      statusCode: 503,
      userId: "private-user-id",
    });

    const record = JSON.parse(String(output.mock.calls[0][0])) as Record<
      string,
      unknown
    >;

    expect(record).toMatchObject({
      event: "test.failure",
      level: "error",
      route: "/api/private",
      statusCode: 503,
      errorType: "Error",
    });
    expect(record).not.toHaveProperty("userId");
    expect(record).not.toHaveProperty("message");
    expect(String(output.mock.calls[0][0])).not.toContain("do-not-log");
    expect(String(output.mock.calls[0][0])).not.toContain("private message");
  });

  it("serializes retry metadata without sensitive fields", () => {
    const output = vi.spyOn(console, "warn").mockImplementation(() => {});

    logWarn("email.delivery_retry", {
      tag: "verify-email",
      attempt: 1,
      delayMs: 250,
      reason: "ECONNECTION",
      token: "secret-token",
      url: "https://edubridge.example/verify-email?token=secret-token",
    });

    const record = JSON.parse(String(output.mock.calls[0][0])) as Record<
      string,
      unknown
    >;
    expect(record).toMatchObject({
      event: "email.delivery_retry",
      tag: "verify-email",
      attempt: 1,
      delayMs: 250,
      reason: "ECONNECTION",
    });
    expect(record).not.toHaveProperty("token");
    expect(String(output.mock.calls[0][0])).not.toContain("secret-token");
  });

  it("logs only allowlisted advisor metrics", () => {
    const output = vi.spyOn(console, "info").mockImplementation(() => {});

    logInfo("advisor.chat_success", {
      provider: "openai",
      model: "gpt-4.1-mini",
      outcome: "SUCCESS",
      toolCount: 2,
      promptTokens: 120,
      completionTokens: 45,
      estimatedCostMicros: 120,
      message: "private answer",
      apiKey: "sk-private",
    });

    const record = JSON.parse(String(output.mock.calls[0][0])) as Record<
      string,
      unknown
    >;
    expect(record).toMatchObject({
      event: "advisor.chat_success",
      provider: "openai",
      model: "gpt-4.1-mini",
      outcome: "SUCCESS",
      toolCount: 2,
      promptTokens: 120,
      completionTokens: 45,
      estimatedCostMicros: 120,
    });
    expect(record).not.toHaveProperty("message");
    expect(record).not.toHaveProperty("apiKey");
    expect(String(output.mock.calls[0][0])).not.toContain("sk-private");
  });

  it("reports missing advisor production settings by name only", () => {
    vi.stubEnv("AI_API_KEY", "");
    vi.stubEnv("AI_MODEL", "");

    const issues = productionConfigurationIssues();

    expect(issues).toContain("AI_API_KEY");
    expect(issues).toContain("AI_MODEL");
    expect(issues.join(" ")).not.toContain("production-ai-key");
  });

  it("requires real contact addresses in production", () => {
    vi.stubEnv("SECURITY_CONTACT_EMAIL", "security@edubridge.example");
    vi.stubEnv("PRIVACY_CONTACT_EMAIL", "privacy@localhost");

    const issues = productionConfigurationIssues();

    expect(issues).toContain("SECURITY_CONTACT_EMAIL");
    expect(issues).toContain("PRIVACY_CONTACT_EMAIL");
  });

  it("rejects development storage and scanner drivers at readiness", () => {
    expect(productionReadinessIssues()).toEqual([]);

    vi.stubEnv("STORAGE_DRIVER", "local");
    vi.stubEnv("MALWARE_SCANNER_DRIVER", "local");
    resetPrivateObjectStorageForTests();

    const issues = productionReadinessIssues();

    expect(issues).toContain("STORAGE_DRIVER");
    expect(issues).toContain("MALWARE_SCANNER_DRIVER/MALWARE_SCANNER_HOST");
  });

  it("uses semantic config validation rather than presence only", () => {
    vi.stubEnv("AI_BASE_URL", "http://internal.example");

    expect(productionReadinessIssues()).toContain("AI_CONFIG");
  });
});
