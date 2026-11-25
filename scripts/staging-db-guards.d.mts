export type StagingUrlFacts = {
  hostname: string;
  port: string;
  database: string;
  identity: string;
  sslMode: string | null;
  channelBinding: string | null;
  certValidatingTls: boolean;
  tlsEnabled: boolean;
  channelBindingDisabled: boolean;
  connectTimeout: boolean;
  poolTimeout: boolean;
  connectionLimit: boolean;
  pgbouncer: boolean;
};

export function inspectStagingUrl(
  value: string | undefined,
  name: string,
): StagingUrlFacts;

export function assertStagingVerificationAllowed(input?: {
  pooledUrl?: string;
  directUrl?: string;
  forbiddenIdentity?: string;
  confirm?: string;
  pooledHostMarker?: string;
}): { pooled: StagingUrlFacts; direct: StagingUrlFacts };

export function assertEmptyStagingDatabase(input: {
  userTables: number;
  migrationRows: number;
  allowExisting?: string;
}): void;

export function assessMigrationHistory(
  actual: Array<{
    migrationName: string;
    finished: boolean;
    rolledBack: boolean;
  }>,
  expected: string[],
): {
  complete: boolean;
  missing: string[];
  extra: string[];
  unsuccessful: string[];
};

export function redactConnectionDetails(
  text: string,
  urls?: Array<string | undefined>,
): string;
