import "server-only";

import { randomUUID } from "node:crypto";

import {
  PRIVATE_DOCUMENT_MAX_BYTES,
  PRIVATE_DOCUMENT_TYPES,
} from "@/lib/workspace/constants";
import {
  getPrivateObjectStorage,
  type ObjectStore,
} from "@/lib/workspace/object-storage";
import type { MalwareScanResult } from "@/lib/workspace/malware-scanner";

const DOCUMENT_PREFIX = "documents/";
const QUARANTINE_PREFIX = "quarantine/";
const STORAGE_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg|png|webp)$/;

export type AcceptedDocument = {
  bytes: Buffer;
  mimeType: keyof typeof PRIVATE_DOCUMENT_TYPES;
  storageKey: string;
};

function matchesSignature(
  mimeType: keyof typeof PRIVATE_DOCUMENT_TYPES,
  bytes: Buffer,
): boolean {
  if (mimeType === "application/pdf") {
    return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  }
  if (mimeType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  return (
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

function assertStorageKey(storageKey: string): void {
  if (!STORAGE_KEY_PATTERN.test(storageKey)) {
    throw new Error("Invalid private document storage key.");
  }
}

export async function inspectDocumentUpload(
  file: File,
): Promise<AcceptedDocument | null> {
  if (
    file.size < 1 ||
    file.size > PRIVATE_DOCUMENT_MAX_BYTES ||
    !Object.hasOwn(PRIVATE_DOCUMENT_TYPES, file.type)
  ) {
    return null;
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type as keyof typeof PRIVATE_DOCUMENT_TYPES;
  if (!matchesSignature(mimeType, bytes)) return null;

  return {
    bytes,
    mimeType,
    storageKey: `${randomUUID()}${PRIVATE_DOCUMENT_TYPES[mimeType]}`,
  };
}

export async function scanAndPromoteDocument(
  storageKey: string,
  bytes: Buffer,
  mimeType: string,
  dependencies: {
    store: ObjectStore;
    bucket: string;
    scan: (bytes: Buffer) => Promise<MalwareScanResult>;
  },
): Promise<"clean" | "infected"> {
  assertStorageKey(storageKey);
  if (!Object.hasOwn(PRIVATE_DOCUMENT_TYPES, mimeType)) {
    throw new Error("Unsupported private document MIME type.");
  }
  if (bytes.length < 1 || bytes.length > PRIVATE_DOCUMENT_MAX_BYTES) {
    throw new Error("Private document size is outside the allowed range.");
  }

  const quarantineKey = `${QUARANTINE_PREFIX}${storageKey}`;
  const documentKey = `${DOCUMENT_PREFIX}${storageKey}`;
  await dependencies.store.put(dependencies.bucket, quarantineKey, bytes, {
    contentType: "application/octet-stream",
    metadata: { "scan-status": "pending" },
  });

  const verdict = await dependencies.scan(bytes);
  if (verdict === "infected") return "infected";
  if (verdict !== "clean") {
    throw new Error("Malware scanner returned an unknown verdict.");
  }

  await dependencies.store.copy(
    dependencies.bucket,
    quarantineKey,
    dependencies.bucket,
    documentKey,
    { "scan-status": "clean", "declared-content-type": mimeType },
  );
  try {
    await dependencies.store.delete(dependencies.bucket, quarantineKey);
  } catch (error) {
    await dependencies.store.delete(dependencies.bucket, documentKey);
    throw error;
  }

  return "clean";
}

export async function storePrivateDocument(
  storageKey: string,
  bytes: Buffer,
  mimeType: string,
  scan: (bytes: Buffer) => Promise<MalwareScanResult>,
): Promise<"clean" | "infected"> {
  const { store, bucket } = getPrivateObjectStorage();
  return scanAndPromoteDocument(storageKey, bytes, mimeType, {
    store,
    bucket,
    scan,
  });
}

export async function readPrivateDocument(
  storageKey: string,
): Promise<Buffer | null> {
  assertStorageKey(storageKey);
  const { store, bucket } = getPrivateObjectStorage();
  return store.get(bucket, `${DOCUMENT_PREFIX}${storageKey}`);
}

export async function removePrivateDocument(storageKey: string): Promise<void> {
  assertStorageKey(storageKey);
  const { store, bucket } = getPrivateObjectStorage();
  await store.delete(bucket, `${QUARANTINE_PREFIX}${storageKey}`);
  await store.delete(bucket, `${DOCUMENT_PREFIX}${storageKey}`);
}
