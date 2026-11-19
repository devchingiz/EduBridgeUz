import { createHash } from "node:crypto";

const STORAGE_KEY =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg|png|webp)$/;
const BACKUP_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertBackupId(backupId) {
  if (!BACKUP_ID.test(backupId)) {
    throw new Error("Backup ID must be a UUID.");
  }
}

function parseManifest(bytes, expectedBackupId) {
  let manifest;
  try {
    manifest = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error("Backup manifest is not valid JSON.");
  }

  if (
    manifest?.version !== 2 ||
    manifest.backupId !== expectedBackupId ||
    !Array.isArray(manifest.objects)
  ) {
    throw new Error(
      "Backup manifest is invalid or does not match the requested backup.",
    );
  }

  for (const object of manifest.objects) {
    if (
      typeof object?.key !== "string" ||
      !object.key.startsWith("documents/") ||
      !STORAGE_KEY.test(object.key.slice("documents/".length)) ||
      object.backupKey !==
        `backups/${expectedBackupId}/objects/${object.key}` ||
      !Number.isSafeInteger(object.sizeBytes) ||
      object.sizeBytes < 1 ||
      typeof object.sha256 !== "string" ||
      !SHA256.test(object.sha256)
    ) {
      throw new Error("Backup manifest contains an invalid object key.");
    }
  }
  return manifest;
}

export async function backupDocumentObjects(
  store,
  sourceBucket,
  backupBucket,
  backupId,
  createdAt = new Date(),
) {
  assertBackupId(backupId);
  if (!sourceBucket || !backupBucket || sourceBucket === backupBucket) {
    throw new Error(
      "Document and backup buckets must be configured separately.",
    );
  }

  const keys = await store.list(sourceBucket, "documents/");
  const objects = [];
  for (const key of keys) {
    if (
      !key.startsWith("documents/") ||
      !STORAGE_KEY.test(key.slice("documents/".length))
    ) {
      throw new Error("Document bucket contains an invalid object key.");
    }
    const sourceBytes = await store.get(sourceBucket, key);
    if (!sourceBytes) {
      throw new Error(`Listed document object is missing: ${key}`);
    }
    const backupKey = `backups/${backupId}/objects/${key}`;
    await store.copy(sourceBucket, key, backupBucket, backupKey);
    const backupBytes = await store.get(backupBucket, backupKey);
    const sourceHash = sha256(sourceBytes);
    if (
      !backupBytes ||
      backupBytes.length !== sourceBytes.length ||
      sha256(backupBytes) !== sourceHash
    ) {
      throw new Error(
        `Backed-up document failed integrity verification: ${key}`,
      );
    }
    objects.push({
      key,
      backupKey,
      sizeBytes: sourceBytes.length,
      sha256: sourceHash,
    });
  }

  const manifest = {
    version: 2,
    backupId,
    createdAt: createdAt.toISOString(),
    objects,
  };
  await store.put(
    backupBucket,
    `backups/${backupId}/manifest.json`,
    Buffer.from(JSON.stringify(manifest), "utf8"),
    { contentType: "application/json" },
  );
  return manifest;
}

export async function restoreDocumentObjects(
  store,
  backupBucket,
  destinationBucket,
  backupId,
) {
  assertBackupId(backupId);
  if (
    !backupBucket ||
    !destinationBucket ||
    backupBucket === destinationBucket
  ) {
    throw new Error(
      "Backup and document buckets must be configured separately.",
    );
  }

  const bytes = await store.get(
    backupBucket,
    `backups/${backupId}/manifest.json`,
  );
  if (!bytes) throw new Error("Backup manifest was not found.");
  const manifest = parseManifest(bytes, backupId);

  for (const object of manifest.objects) {
    const backupBytes = await store.get(backupBucket, object.backupKey);
    if (
      !backupBytes ||
      backupBytes.length !== object.sizeBytes ||
      sha256(backupBytes) !== object.sha256
    ) {
      throw new Error(
        `Backup document failed integrity verification: ${object.key}`,
      );
    }
    await store.copy(
      backupBucket,
      object.backupKey,
      destinationBucket,
      object.key,
    );
    const restoredBytes = await store.get(destinationBucket, object.key);
    if (
      !restoredBytes ||
      restoredBytes.length !== object.sizeBytes ||
      sha256(restoredBytes) !== object.sha256
    ) {
      throw new Error(
        `Restored document failed integrity verification: ${object.key}`,
      );
    }
  }
  return { backupId, restoredObjects: manifest.objects.length };
}

export function verifyDocumentReferences(storageKeys, manifest) {
  const restoredKeys = new Set(
    storageKeys.map((storageKey) => `documents/${storageKey}`),
  );
  const backupKeys = new Set(manifest.objects.map(({ key }) => key));
  if (
    restoredKeys.size !== backupKeys.size ||
    [...restoredKeys].some((key) => !backupKeys.has(key))
  ) {
    throw new Error(
      "Restored database document references do not match the backup manifest.",
    );
  }
}
