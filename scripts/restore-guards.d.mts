export type DatabaseIdentity = {
  protocol: "postgresql";
  hostname: string;
  port: string;
  database: string;
  identity: string;
};

export function parseDatabaseIdentity(value: string): DatabaseIdentity;

export function assertRestoreTargetIsIsolated(input: {
  databaseUrl?: string;
  restoreUrl: string;
  targetName?: string;
}): DatabaseIdentity;

export type BucketListResult = {
  KeyCount?: number;
  Contents?: unknown[];
  IsTruncated?: boolean;
};

export function assertEmptyRestoreBucket(
  listObjects: (bucket: string) => Promise<BucketListResult>,
  bucket: string,
): Promise<void>;
