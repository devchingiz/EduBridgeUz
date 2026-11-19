import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createFileSystemObjectStore,
  createS3ObjectStore,
  getPrivateObjectStorage,
  resetPrivateObjectStorageForTests,
} from "@/lib/workspace/object-storage";

const requiredEnvironment = [
  "STORAGE_REGION",
  "STORAGE_BUCKET",
  "STORAGE_BACKUP_BUCKET",
  "STORAGE_ENDPOINT",
  "STORAGE_ACCESS_KEY_ID",
  "STORAGE_SECRET_ACCESS_KEY",
  "STORAGE_SERVER_SIDE_ENCRYPTION",
  "STORAGE_KMS_KEY_ID",
  "STORAGE_DRIVER",
  "STORAGE_LOCAL_DIR",
] as const;
const originalEnvironment = Object.fromEntries(
  requiredEnvironment.map((name) => [name, process.env[name]]),
);

afterEach(() => {
  for (const name of requiredEnvironment) {
    const value = originalEnvironment[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  resetPrivateObjectStorageForTests();
  vi.unstubAllEnvs();
});

describe("private S3-compatible object storage", () => {
  it("writes objects with private-safe metadata and server-side encryption", async () => {
    const send = vi.fn(async (_command: unknown) => ({}));
    const store = createS3ObjectStore(
      { region: "test", serverSideEncryption: "AES256" },
      { send } as unknown as S3Client,
    );

    await store.put(
      "private-bucket",
      "documents/one.pdf",
      Buffer.from("data"),
      {
        contentType: "application/octet-stream",
        metadata: { "scan-status": "pending" },
      },
    );

    const command = send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    if (!(command instanceof PutObjectCommand)) {
      throw new Error("Expected an S3 PutObject command.");
    }
    expect(command.input).toMatchObject({
      Bucket: "private-bucket",
      Key: "documents/one.pdf",
      ContentType: "application/octet-stream",
      ServerSideEncryption: "AES256",
      Metadata: { "scan-status": "pending" },
    });
    expect(command.input).not.toHaveProperty("ACL");
  });

  it("returns private object bytes and treats only not-found as absent", async () => {
    const body = Buffer.from("private data");
    const send = vi
      .fn()
      .mockResolvedValueOnce({
        Body: { transformToByteArray: async () => body },
      })
      .mockRejectedValueOnce({ $metadata: { httpStatusCode: 404 } })
      .mockRejectedValueOnce(new Error("provider unavailable"));
    const store = createS3ObjectStore(
      { region: "test", serverSideEncryption: "AES256" },
      { send } as unknown as S3Client,
    );

    await expect(
      store.get("private-bucket", "documents/one.pdf"),
    ).resolves.toEqual(body);
    await expect(
      store.get("private-bucket", "documents/missing.pdf"),
    ).resolves.toBeNull();
    await expect(
      store.get("private-bucket", "documents/one.pdf"),
    ).rejects.toThrow("provider unavailable");
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(GetObjectCommand);
  });

  it("rejects missing storage configuration and invalid endpoints", () => {
    for (const name of requiredEnvironment) delete process.env[name];
    expect(() => getPrivateObjectStorage()).toThrow(
      "STORAGE_REGION, STORAGE_BUCKET, and STORAGE_BACKUP_BUCKET",
    );

    Object.assign(process.env, {
      STORAGE_REGION: "test",
      STORAGE_BUCKET: "documents",
      STORAGE_BACKUP_BUCKET: "backups",
      STORAGE_ENDPOINT: "http://objects.example.test",
    });
    expect(() => getPrivateObjectStorage()).toThrow(
      "STORAGE_ENDPOINT must use HTTPS",
    );
  });

  it("rejects one-sided credentials and missing KMS keys", () => {
    Object.assign(process.env, {
      STORAGE_REGION: "test",
      STORAGE_BUCKET: "documents",
      STORAGE_BACKUP_BUCKET: "backups",
      STORAGE_ACCESS_KEY_ID: "only-one",
    });
    expect(() => getPrivateObjectStorage()).toThrow(
      "Set both STORAGE_ACCESS_KEY_ID and STORAGE_SECRET_ACCESS_KEY",
    );

    delete process.env.STORAGE_ACCESS_KEY_ID;
    Object.assign(process.env, {
      STORAGE_SERVER_SIDE_ENCRYPTION: "aws:kms",
    });
    expect(() => getPrivateObjectStorage()).toThrow(
      "STORAGE_KMS_KEY_ID is required",
    );
  });
});

describe("local development object storage", () => {
  it("stores, copies, lists, and deletes objects with path-safe keys", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "edubridge-store-"));
    try {
      const store = createFileSystemObjectStore(root);
      await store.put("documents", "quarantine/one.pdf", Buffer.from("bytes"), {
        contentType: "application/octet-stream",
        metadata: { "scan-status": "pending" },
      });

      await expect(
        store.get("documents", "quarantine/one.pdf"),
      ).resolves.toEqual(Buffer.from("bytes"));
      await expect(store.get("documents", "missing.pdf")).resolves.toBeNull();

      await store.copy(
        "documents",
        "quarantine/one.pdf",
        "documents",
        "documents/one.pdf",
      );
      expect(await store.list("documents", "documents/")).toEqual([
        "documents/one.pdf",
      ]);

      await store.delete("documents", "quarantine/one.pdf");
      await expect(
        store.get("documents", "quarantine/one.pdf"),
      ).resolves.toBeNull();
      await store.delete("documents", "quarantine/one.pdf");
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("rejects path traversal in bucket, key, and prefix", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "edubridge-store-"));
    try {
      const store = createFileSystemObjectStore(root);
      await expect(
        store.put("documents", "../escape.pdf", Buffer.from("x")),
      ).rejects.toThrow("Invalid local object key.");
      await expect(
        store.put("../documents", "one.pdf", Buffer.from("x")),
      ).rejects.toThrow("Invalid local object bucket.");
      await expect(store.list("documents", "..")).rejects.toThrow(
        "Invalid local object prefix.",
      );
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("selects the local driver only outside production", async () => {
    for (const name of requiredEnvironment) delete process.env[name];
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "edubridge-store-"));
    try {
      Object.assign(process.env, {
        STORAGE_DRIVER: "local",
        STORAGE_LOCAL_DIR: root,
      });
      resetPrivateObjectStorageForTests();
      const local = getPrivateObjectStorage();
      expect(local.bucket).toBe("documents");
      expect(local.backupBucket).toBe("backups");
      await local.store.put(local.bucket, "documents/a.pdf", Buffer.from("a"));
      await expect(
        local.store.get(local.bucket, "documents/a.pdf"),
      ).resolves.toEqual(Buffer.from("a"));

      vi.stubEnv("NODE_ENV", "production");
      resetPrivateObjectStorageForTests();
      expect(() => getPrivateObjectStorage()).toThrow(
        "Local object storage is not allowed in production",
      );
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
