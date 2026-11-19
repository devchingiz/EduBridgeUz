export type BackupObjectStore = {
  list(bucket: string, prefix: string): Promise<string[]>;
  copy(
    sourceBucket: string,
    sourceKey: string,
    destinationBucket: string,
    destinationKey: string,
  ): Promise<void>;
  get(bucket: string, key: string): Promise<Buffer | null>;
  put(
    bucket: string,
    key: string,
    body: Buffer,
    options?: { contentType?: string },
  ): Promise<void>;
};

export type WorkspaceBackupManifest = {
  version: 2;
  backupId: string;
  createdAt: string;
  databaseDumpKey?: string;
  databaseDumpBytes?: number;
  databaseDumpSha256?: string;
  objects: Array<{
    key: string;
    backupKey: string;
    sizeBytes: number;
    sha256: string;
  }>;
};

export function backupDocumentObjects(
  store: BackupObjectStore,
  sourceBucket: string,
  backupBucket: string,
  backupId: string,
  createdAt?: Date,
): Promise<WorkspaceBackupManifest>;

export function restoreDocumentObjects(
  store: BackupObjectStore,
  backupBucket: string,
  destinationBucket: string,
  backupId: string,
): Promise<{ backupId: string; restoredObjects: number }>;

export function verifyDocumentReferences(
  storageKeys: string[],
  manifest: WorkspaceBackupManifest,
): void;
