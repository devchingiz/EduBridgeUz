import "server-only";

/**
 * Server environment access.
 *
 * Values are read lazily so a missing secret fails at request time with a clear
 * message instead of breaking `next build` in environments that do not need it.
 */

function read(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

function isValidProductionAppUrl(value: string | undefined): boolean {
  try {
    const url = value ? new URL(value) : null;
    return Boolean(
      url &&
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash,
    );
  } catch {
    return false;
  }
}

type ProductionDatabaseUrlChecks = {
  valid: boolean;
  tls: boolean;
  timeouts: boolean;
  pool: boolean;
};

function hasPositiveIntegerParam(url: URL, name: string): boolean {
  const raw = url.searchParams.get(name);
  if (raw === null || raw.trim() === "") return false;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 && value <= 2_147_483_647;
}

/**
 * Production may not fall back to an unencrypted connection, an unbounded wait,
 * or an unbounded pool. Issue names are reported rather than values so a bad URL
 * cannot leak credentials into readiness output or logs.
 */
function checkProductionDatabaseUrl(
  value: string | undefined,
): ProductionDatabaseUrlChecks {
  const invalid: ProductionDatabaseUrlChecks = {
    valid: false,
    tls: false,
    timeouts: false,
    pool: false,
  };
  if (!value) return invalid;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return invalid;
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname) {
    return invalid;
  }
  try {
    const database = decodeURIComponent(
      url.pathname.replace(/^\//, "").replace(/\/$/, ""),
    );
    if (!database) return invalid;
  } catch {
    return invalid;
  }

  const sslmode = url.searchParams.get("sslmode")?.toLowerCase();
  return {
    valid: true,
    tls:
      sslmode === "require" ||
      sslmode === "verify-ca" ||
      sslmode === "verify-full",
    timeouts:
      hasPositiveIntegerParam(url, "connect_timeout") &&
      hasPositiveIntegerParam(url, "pool_timeout"),
    pool: hasPositiveIntegerParam(url, "connection_limit"),
  };
}

/** Rejects placeholders and reserved domains so production cannot ship a contact that cannot receive mail. */
function isDeliverableEmail(value: string | undefined): boolean {
  if (!value) return false;

  const match = value.match(/<([^\s@]+@[^\s@]+\.[^\s@]{2,})>/) ?? [
    ,
    value.trim(),
  ];
  const address = match[1];
  if (!address || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(address)) return false;

  const domain = address.split("@")[1]?.toLowerCase() ?? "";
  return !/(^|\.)(example|invalid|test|localhost)$/.test(domain);
}

export function getAppUrl(): string {
  const url = read("NEXT_PUBLIC_APP_URL");
  if (isProduction() && !isValidProductionAppUrl(url)) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL must be an HTTPS origin in production.",
    );
  }
  return url ?? "http://localhost:3000";
}

export function getDatabaseUrl(): string {
  const url = read("DATABASE_URL");
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Start the local database with `npm run db:start` or provide a PostgreSQL connection string.",
    );
  }
  return url;
}

export function getAuthSecret(): string {
  const secret = read("AUTH_SECRET");
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET must be set to at least 32 characters. Generate one with `node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"`.",
    );
  }
  return secret;
}

/**
 * Fixed timestamp that starts email-verification enforcement. This is read at
 * request time rather than baked into a build, but it must be set once for the
 * rollout and then left unchanged so redeploys do not reset legacy grace.
 */
export function getVerificationEnforcementStart(): Date | null {
  const value = read("EMAIL_VERIFICATION_ENFORCEMENT_START");
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp);
}

/** Missing and malformed values are both invalid; callers must fail closed. */
export function hasValidVerificationEnforcementStart(): boolean {
  return getVerificationEnforcementStart() !== null;
}

/**
 * Comma-separated account emails that a trusted operator wants to promote to
 * Super Admin on their next successful sign-in. This is bootstrap-only: the
 * panel cannot set it, and an empty value disables the path entirely.
 */
/**
 * MFA seeds are encrypted with a dedicated key so rotating AUTH_SECRET does not
 * silently lock enrolled accounts out. It must be high-entropy and stable.
 */
export function getMfaEncryptionKey(): string {
  return read("MFA_ENCRYPTION_KEY") ?? getAuthSecret();
}

export function getBootstrapAdminEmails(): string[] {
  const configured = read("BOOTSTRAP_ADMIN_EMAILS");
  if (!configured) return [];
  return Array.from(
    new Set(
      configured
        .split(/[,\n]/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

export function hasInvalidBootstrapAdminEmails(): boolean {
  const configured = read("BOOTSTRAP_ADMIN_EMAILS");
  if (!configured) return false;
  return configured
    .split(/[,\n]/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
    .some((email) => !isDeliverableEmail(email));
}

export function getSecurityContactEmail(): string | null {
  const email = read("SECURITY_CONTACT_EMAIL");
  return email && isDeliverableEmail(email) ? email : null;
}

export function getPrivacyContactEmail(): string | null {
  const email = read("PRIVACY_CONTACT_EMAIL");
  return email && isDeliverableEmail(email) ? email : null;
}

export function getGoogleOAuthConfig(): {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
} | null {
  const clientId = read("GOOGLE_CLIENT_ID");
  const clientSecret = read("GOOGLE_CLIENT_SECRET");
  if (!clientId && !clientSecret) return null;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Google sign-in requires both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
    );
  }
  return {
    clientId,
    clientSecret,
    callbackUrl: `${getAppUrl().replace(/\/+$/, "")}/api/auth/google/callback`,
  };
}

export type EmailTransport = "console" | "smtp";

export function getEmailConfig():
  | { transport: "console" }
  | {
      transport: "smtp";
      host: string;
      port: number;
      user?: string;
      password?: string;
      secure: boolean;
    } {
  const configuredTransport = read("EMAIL_TRANSPORT") ?? "console";
  if (configuredTransport !== "console" && configuredTransport !== "smtp") {
    throw new Error("EMAIL_TRANSPORT must be console or smtp.");
  }
  const transport: EmailTransport = configuredTransport;

  if (transport === "smtp") {
    const host = read("SMTP_HOST");
    if (!host) {
      throw new Error("EMAIL_TRANSPORT=smtp requires SMTP_HOST.");
    }
    const port = Number(read("SMTP_PORT") ?? "587");
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error("SMTP_PORT must be a valid TCP port.");
    }
    return {
      transport: "smtp",
      host,
      port,
      user: read("SMTP_USER"),
      password: read("SMTP_PASSWORD"),
      secure: read("SMTP_SECURE") === "true",
    };
  }

  if (process.env.NODE_ENV === "production") {
    // Fail loudly rather than silently dropping verification and reset emails.
    throw new Error(
      "EMAIL_TRANSPORT=console is not allowed in production. Configure SMTP.",
    );
  }

  return { transport: "console" };
}

export function getEmailFrom(): string {
  return read("EMAIL_FROM") ?? "EduBridge <no-reply@edubridge.example>";
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function isHttpUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Returns missing or invalid production setting names without exposing values.
 * Readiness checks use this to keep a misconfigured instance out of rotation.
 */
export function productionConfigurationIssues(): string[] {
  if (!isProduction()) return [];

  const issues: string[] = [];
  const appUrl = read("NEXT_PUBLIC_APP_URL");
  if (!isValidProductionAppUrl(appUrl)) issues.push("NEXT_PUBLIC_APP_URL");

  const database = checkProductionDatabaseUrl(read("DATABASE_URL"));
  if (!database.valid) {
    issues.push("DATABASE_URL");
  } else {
    if (!database.tls) issues.push("DATABASE_URL_TLS");
    if (!database.timeouts) issues.push("DATABASE_URL_TIMEOUTS");
    if (!database.pool) issues.push("DATABASE_URL_POOL");
  }

  const authSecret = read("AUTH_SECRET");
  if (!authSecret || authSecret.length < 32) issues.push("AUTH_SECRET");

  if (!hasValidVerificationEnforcementStart()) {
    issues.push("EMAIL_VERIFICATION_ENFORCEMENT_START");
  }

  if (read("EMAIL_TRANSPORT") !== "smtp" || !read("SMTP_HOST")) {
    issues.push("EMAIL_TRANSPORT/SMTP_HOST");
  }
  if (!isDeliverableEmail(read("EMAIL_FROM"))) issues.push("EMAIL_FROM");
  const mfaEncryptionKey = read("MFA_ENCRYPTION_KEY");
  if (!mfaEncryptionKey || mfaEncryptionKey.length < 32) {
    issues.push("MFA_ENCRYPTION_KEY");
  }
  if (!getSecurityContactEmail()) issues.push("SECURITY_CONTACT_EMAIL");
  if (!getPrivacyContactEmail()) issues.push("PRIVACY_CONTACT_EMAIL");
  if (hasInvalidBootstrapAdminEmails()) issues.push("BOOTSTRAP_ADMIN_EMAILS");
  if (!read("GOOGLE_CLIENT_ID") || !read("GOOGLE_CLIENT_SECRET")) {
    issues.push("GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET");
  }
  const smtpPort = Number(read("SMTP_PORT") ?? "587");
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
    issues.push("SMTP_PORT");
  }

  const storageDriver = read("STORAGE_DRIVER") ?? "s3";
  if (storageDriver !== "s3") issues.push("STORAGE_DRIVER");

  const region = read("STORAGE_REGION");
  const bucket = read("STORAGE_BUCKET");
  const backupBucket = read("STORAGE_BACKUP_BUCKET");
  if (!region) issues.push("STORAGE_REGION");
  if (!bucket) issues.push("STORAGE_BUCKET");
  if (!backupBucket) issues.push("STORAGE_BACKUP_BUCKET");
  if (bucket && backupBucket && bucket === backupBucket) {
    issues.push("STORAGE_BACKUP_BUCKET");
  }
  if (
    Boolean(read("STORAGE_ACCESS_KEY_ID")) !==
    Boolean(read("STORAGE_SECRET_ACCESS_KEY"))
  ) {
    issues.push("STORAGE_ACCESS_KEY_ID/STORAGE_SECRET_ACCESS_KEY");
  }
  const encryption = read("STORAGE_SERVER_SIDE_ENCRYPTION") ?? "AES256";
  if (encryption !== "AES256" && encryption !== "aws:kms") {
    issues.push("STORAGE_SERVER_SIDE_ENCRYPTION");
  }
  if (encryption === "aws:kms" && !read("STORAGE_KMS_KEY_ID")) {
    issues.push("STORAGE_KMS_KEY_ID");
  }

  const storageEndpoint = read("STORAGE_ENDPOINT");
  if (storageEndpoint) {
    try {
      if (new URL(storageEndpoint).protocol !== "https:") {
        issues.push("STORAGE_ENDPOINT");
      }
    } catch {
      issues.push("STORAGE_ENDPOINT");
    }
  }

  const scannerDriver = read("MALWARE_SCANNER_DRIVER") ?? "clamd";
  if (scannerDriver !== "clamd") issues.push("MALWARE_SCANNER_DRIVER");

  const scannerHost = read("MALWARE_SCANNER_HOST");
  const scannerPort = Number(read("MALWARE_SCANNER_PORT") ?? "3310");
  if (!scannerHost) issues.push("MALWARE_SCANNER_HOST");
  if (
    !Number.isInteger(scannerPort) ||
    scannerPort < 1 ||
    scannerPort > 65535
  ) {
    issues.push("MALWARE_SCANNER_PORT");
  }

  const telemetryEndpoint = read("OTEL_EXPORTER_OTLP_ENDPOINT");
  if (!isHttpUrl(telemetryEndpoint)) {
    issues.push("OTEL_EXPORTER_OTLP_ENDPOINT");
  }

  // The advisor is a product feature in production, so a missing key must keep
  // the instance out of rotation rather than showing a permanently broken UI.
  const aiProvider = read("AI_PROVIDER");
  if (
    !aiProvider ||
    !["openai", "anthropic", "openrouter", "compatible"].includes(aiProvider)
  ) {
    issues.push("AI_PROVIDER");
  }
  if (!read("AI_API_KEY")) issues.push("AI_API_KEY");
  if (!read("AI_MODEL")) issues.push("AI_MODEL");

  return [...new Set(issues)];
}
