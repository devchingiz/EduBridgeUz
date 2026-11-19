import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { createReadStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";

import {
  CopyObjectCommand,
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";

import { postgresClientEnvironment } from "./postgres-client-env.mjs";
import {
  restoreDocumentObjects,
  verifyDocumentReferences,
} from "./workspace-backup.mjs";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function sha256File(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

function createClient() {
  const endpoint = process.env.STORAGE_ENDPOINT?.trim();
  const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY?.trim();
  if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
    throw new Error(
      "Set both STORAGE_ACCESS_KEY_ID and STORAGE_SECRET_ACCESS_KEY, or neither to use the provider credential chain.",
    );
  }
  if (
    endpoint &&
    new URL(endpoint).protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(new URL(endpoint).hostname)
  ) {
    throw new Error(
      "STORAGE_ENDPOINT must use HTTPS except for local development.",
    );
  }
  return new S3Client({
    region: required("STORAGE_REGION"),
    maxAttempts: 3,
    endpoint: endpoint || undefined,
    forcePathStyle: Boolean(endpoint),
    credentials: accessKeyId
      ? {
          accessKeyId,
          secretAccessKey,
          sessionToken: process.env.STORAGE_SESSION_TOKEN?.trim() || undefined,
        }
      : undefined,
  });
}

function getEncryption() {
  const mode = process.env.STORAGE_SERVER_SIDE_ENCRYPTION?.trim() || "AES256";
  if (mode === "AES256") return { ServerSideEncryption: "AES256" };
  if (mode === "aws:kms") {
    const keyId = process.env.STORAGE_KMS_KEY_ID?.trim();
    if (!keyId) throw new Error("STORAGE_KMS_KEY_ID is required for aws:kms.");
    return { ServerSideEncryption: "aws:kms", SSEKMSKeyId: keyId };
  }
  throw new Error("STORAGE_SERVER_SIDE_ENCRYPTION must be AES256 or aws:kms.");
}

function encodeCopySource(bucket, key) {
  return `${encodeURIComponent(bucket)}/${key
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

function createRestoreStore(client, encryption) {
  return {
    async get(bucket, key) {
      try {
        const output = await client.send(
          new GetObjectCommand({ Bucket: bucket, Key: key }),
        );
        return output.Body
          ? Buffer.from(await output.Body.transformToByteArray())
          : null;
      } catch (error) {
        if (error?.$metadata?.httpStatusCode === 404) return null;
        throw error;
      }
    },
    async copy(sourceBucket, sourceKey, destinationBucket, destinationKey) {
      await client.send(
        new CopyObjectCommand({
          Bucket: destinationBucket,
          Key: destinationKey,
          CopySource: encodeCopySource(sourceBucket, sourceKey),
          ...encryption,
        }),
      );
    },
  };
}

async function run(command, args, env = process.env) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      windowsHide: true,
      env,
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}.`));
    });
  });
}

async function main() {
  if (process.env.RESTORE_CONFIRM !== "RESTORE") {
    throw new Error(
      "Set RESTORE_CONFIRM=RESTORE to authorize a destructive database restore.",
    );
  }
  const backupId = required("BACKUP_ID");
  const restoreDatabaseUrl = required("RESTORE_DATABASE_URL");
  if (
    process.env.DATABASE_URL &&
    restoreDatabaseUrl === process.env.DATABASE_URL
  ) {
    throw new Error(
      "RESTORE_DATABASE_URL must target a separate recovery database, not DATABASE_URL.",
    );
  }
  const documentBucket = required("RESTORE_DOCUMENT_BUCKET");
  const backupBucket = required("STORAGE_BACKUP_BUCKET");
  if (documentBucket === backupBucket) {
    throw new Error(
      "RESTORE_DOCUMENT_BUCKET and STORAGE_BACKUP_BUCKET must differ.",
    );
  }
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      backupId,
    )
  ) {
    throw new Error("BACKUP_ID must be a UUID.");
  }

  const encryption = getEncryption();
  const client = createClient();
  const store = createRestoreStore(client, encryption);
  let tempDir;

  try {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "edubridge-restore-"));
    const dumpPath = path.join(tempDir, "database.dump");
    const manifestBytes = await store.get(
      backupBucket,
      `backups/${backupId}/manifest.json`,
    );
    if (!manifestBytes) throw new Error("Backup manifest was not found.");
    let manifest;
    try {
      manifest = JSON.parse(manifestBytes.toString("utf8"));
    } catch {
      throw new Error("Backup manifest is invalid JSON.");
    }
    if (
      manifest?.backupId !== backupId ||
      manifest?.version !== 2 ||
      manifest?.databaseDumpKey !== `backups/${backupId}/database.dump` ||
      !Number.isSafeInteger(manifest.databaseDumpBytes) ||
      manifest.databaseDumpBytes < 1 ||
      !/^[0-9a-f]{64}$/.test(manifest.databaseDumpSha256) ||
      !Array.isArray(manifest.objects)
    ) {
      throw new Error("Backup manifest is incomplete or invalid.");
    }

    const databaseDump = await client.send(
      new GetObjectCommand({
        Bucket: backupBucket,
        Key: manifest.databaseDumpKey,
      }),
    );
    if (!databaseDump.Body) throw new Error("Database dump is unavailable.");
    if (databaseDump.ContentLength !== manifest.databaseDumpBytes) {
      throw new Error("Database dump size does not match the backup manifest.");
    }
    await pipeline(
      databaseDump.Body,
      createWriteStream(dumpPath, { flags: "wx" }),
    );
    if ((await sha256File(dumpPath)) !== manifest.databaseDumpSha256) {
      throw new Error("Database dump failed integrity verification.");
    }

    const restored = await restoreDocumentObjects(
      store,
      backupBucket,
      documentBucket,
      backupId,
    );
    const databaseEnvironment = postgresClientEnvironment(restoreDatabaseUrl);
    await run(
      "pg_restore",
      [
        "--exit-on-error",
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-acl",
        "--dbname",
        databaseEnvironment.PGDATABASE,
        dumpPath,
      ],
      databaseEnvironment,
    );

    const restoredDatabase = new PrismaClient({
      datasources: { db: { url: restoreDatabaseUrl } },
    });
    try {
      const restoredDocuments = await restoredDatabase.studentDocument.findMany(
        { select: { storageKey: true } },
      );
      verifyDocumentReferences(
        restoredDocuments.map(({ storageKey }) => storageKey),
        manifest,
      );
    } finally {
      await restoredDatabase.$disconnect();
    }

    console.log(
      JSON.stringify({
        event: "restore.completed",
        backupId,
        restoredObjects: restored.restoredObjects,
      }),
    );
  } finally {
    client.destroy();
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error("[restore] failed", error);
  process.exitCode = 1;
});
