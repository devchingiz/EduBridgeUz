import type { DatabaseIdentity } from "./restore-guards.mjs";

export function assertLocalDatabasePushAllowed(input?: {
  databaseUrl?: string;
  nodeEnv?: string;
}): DatabaseIdentity;
