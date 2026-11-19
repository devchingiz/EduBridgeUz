import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { postgresClientEnvironment } from "./postgres-client-env.mjs";
import { backupDocumentObjects } from "./workspace-backup.mjs";

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

function createBackupStore(client, encryption) {
  return {
    async put(bucket, key, body, options) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentLength: body.length,
          ContentType: options?.contentType,
          ...encryption,
        }),
      );
    },
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
    async delete(bucket, key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
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
    async list(bucket, prefix) {
      const keys = [];
      let continuationToken;
      do {
        const page = await client.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
            ContinuationToken: continuationToken,
          }),
        );
        keys.push(
          ...(page.Contents ?? []).map((object) => object.Key).filter(Boolean),
        );
        continuationToken = page.IsTruncated
          ? page.NextContinuationToken
          : undefined;
      } while (continuationToken);
      return keys;
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
  const databaseUrl = required("DATABASE_URL");
  const documentBucket = required("STORAGE_BUCKET");
  const backupBucket = required("STORAGE_BACKUP_BUCKET");
  if (documentBucket === backupBucket) {
    throw new Error("STORAGE_BUCKET and STORAGE_BACKUP_BUCKET must differ.");
  }

  const encryption = getEncryption();
  const client = createClient();
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "edubridge-backup-"));
  const dumpPath = path.join(tempDir, "database.dump");
  const store = createBackupStore(client, encryption);
  const backupId = randomUUID();

  try {
    await run(
      "pg_dump",
      ["--format=custom", "--no-owner", "--no-acl", "--file", dumpPath],
      postgresClientEnvironment(databaseUrl),
    );

    const manifest = await backupDocumentObjects(
      store,
      documentBucket,
      backupBucket,
      backupId,
    );
    const dumpInfo = await stat(dumpPath);
    await client.send(
      new PutObjectCommand({
        Bucket: backupBucket,
        Key: `backups/${backupId}/database.dump`,
        Body: createReadStream(dumpPath),
        ContentLength: dumpInfo.size,
        ContentType: "application/octet-stream",
        ...encryption,
      }),
    );
    manifest.databaseDumpKey = `backups/${backupId}/database.dump`;
    manifest.databaseDumpBytes = dumpInfo.size;
    manifest.databaseDumpSha256 = await sha256File(dumpPath);
    await store.put(
      backupBucket,
      `backups/${backupId}/manifest.json`,
      Buffer.from(JSON.stringify(manifest), "utf8"),
      { contentType: "application/json" },
    );
    console.log(
      JSON.stringify({
        event: "backup.completed",
        backupId,
        documents: manifest.objects.length,
        databaseBytes: dumpInfo.size,
      }),
    );
  } finally {
    client.destroy();
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error("[backup] failed", error);
  process.exitCode = 1;
});
