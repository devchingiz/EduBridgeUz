import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";

import {
  backupDocumentObjects,
  restoreDocumentObjects,
  verifyDocumentReferences,
} from "../../scripts/workspace-backup.mjs";

const backupId = "123e4567-e89b-12d3-a456-426614174000";
const storageKey = "123e4567-e89b-12d3-a456-426614174001.pdf";
const documentBytes = Buffer.from("%PDF-1.7\nprivate");
const documentSha256 = createHash("sha256").update(documentBytes).digest("hex");

function createStore() {
  const objects = new Map<string, Buffer>();
  return {
    objects,
    async list(bucket: string, prefix: string) {
      return [...objects.keys()]
        .filter((key) => key.startsWith(`${bucket}/${prefix}`))
        .map((key) => key.slice(bucket.length + 1));
    },
    async put(bucket: string, key: string, body: Buffer) {
      objects.set(`${bucket}/${key}`, Buffer.from(body));
    },
    async get(bucket: string, key: string) {
      return objects.get(`${bucket}/${key}`) ?? null;
    },
    async copy(
      sourceBucket: string,
      sourceKey: string,
      destinationBucket: string,
      destinationKey: string,
    ) {
      const source = objects.get(`${sourceBucket}/${sourceKey}`);
      if (!source) throw new Error("Source object does not exist.");
      objects.set(
        `${destinationBucket}/${destinationKey}`,
        Buffer.from(source),
      );
    },
  };
}

describe("private document backup and restore", () => {
  it("backs up document objects with a manifest and restores them", async () => {
    const store = createStore();
    store.objects.set(`documents/documents/${storageKey}`, documentBytes);

    const manifest = await backupDocumentObjects(
      store,
      "documents",
      "backups",
      backupId,
      new Date("2025-01-01T00:00:00.000Z"),
    );
    expect(manifest.objects).toEqual([
      {
        key: `documents/${storageKey}`,
        backupKey: `backups/${backupId}/objects/documents/${storageKey}`,
        sizeBytes: documentBytes.length,
        sha256: documentSha256,
      },
    ]);

    const result = await restoreDocumentObjects(
      store,
      "backups",
      "restored-documents",
      backupId,
    );
    expect(result.restoredObjects).toBe(1);
    expect(
      store.objects.get(`restored-documents/documents/${storageKey}`),
    ).toEqual(documentBytes);
  });

  it("rejects malformed manifests before copying any file", async () => {
    const store = createStore();
    await store.put(
      "backups",
      `backups/${backupId}/manifest.json`,
      Buffer.from(
        JSON.stringify({
          version: 2,
          backupId,
          objects: [
            {
              key: "documents/../../private",
              backupKey: `backups/${backupId}/objects/documents/../../private`,
            },
          ],
        }),
      ),
    );

    await expect(
      restoreDocumentObjects(store, "backups", "restored-documents", backupId),
    ).rejects.toThrow("invalid object key");
    expect(
      [...store.objects.keys()].some((key) =>
        key.startsWith("restored-documents/"),
      ),
    ).toBe(false);
  });

  it("does not write a manifest when backing up an object fails", async () => {
    const store = createStore();
    store.objects.set(`documents/documents/${storageKey}`, Buffer.from("data"));
    store.copy = async () => {
      throw new Error("copy failed");
    };

    await expect(
      backupDocumentObjects(store, "documents", "backups", backupId),
    ).rejects.toThrow("copy failed");
    expect(store.objects.has(`backups/backups/${backupId}/manifest.json`)).toBe(
      false,
    );
  });

  it("reports restore copy failures without claiming a successful restore", async () => {
    const store = createStore();
    store.objects.set(
      `backups/backups/${backupId}/objects/documents/${storageKey}`,
      documentBytes,
    );
    await store.put(
      "backups",
      `backups/${backupId}/manifest.json`,
      Buffer.from(
        JSON.stringify({
          version: 2,
          backupId,
          objects: [
            {
              key: `documents/${storageKey}`,
              backupKey: `backups/${backupId}/objects/documents/${storageKey}`,
              sizeBytes: documentBytes.length,
              sha256: documentSha256,
            },
          ],
        }),
      ),
    );
    store.copy = async () => {
      throw new Error("restore copy failed");
    };

    await expect(
      restoreDocumentObjects(store, "backups", "restored-documents", backupId),
    ).rejects.toThrow("restore copy failed");
  });

  it("refuses to restore a backup object with a mismatched checksum", async () => {
    const store = createStore();
    store.objects.set(
      `backups/backups/${backupId}/objects/documents/${storageKey}`,
      Buffer.from("tampered"),
    );
    await store.put(
      "backups",
      `backups/${backupId}/manifest.json`,
      Buffer.from(
        JSON.stringify({
          version: 2,
          backupId,
          objects: [
            {
              key: `documents/${storageKey}`,
              backupKey: `backups/${backupId}/objects/documents/${storageKey}`,
              sizeBytes: documentBytes.length,
              sha256: documentSha256,
            },
          ],
        }),
      ),
    );

    await expect(
      restoreDocumentObjects(store, "backups", "restored-documents", backupId),
    ).rejects.toThrow("failed integrity verification");
    expect(
      [...store.objects.keys()].some((key) =>
        key.startsWith("restored-documents/"),
      ),
    ).toBe(false);
  });

  it("verifies restored database document references against the manifest", () => {
    const manifest = {
      version: 2 as const,
      backupId,
      createdAt: "2025-01-01T00:00:00.000Z",
      objects: [
        {
          key: `documents/${storageKey}`,
          backupKey: `backups/${backupId}/objects/documents/${storageKey}`,
          sizeBytes: documentBytes.length,
          sha256: documentSha256,
        },
      ],
    };
    expect(() =>
      verifyDocumentReferences([storageKey], manifest),
    ).not.toThrow();
    expect(() => verifyDocumentReferences([], manifest)).toThrow(
      "do not match the backup manifest",
    );
    expect(() =>
      verifyDocumentReferences(
        [storageKey, "123e4567-e89b-12d3-a456-426614174002.pdf"],
        manifest,
      ),
    ).toThrow("do not match the backup manifest");
  });
});
