import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";

export type ObjectStore = {
  put(
    bucket: string,
    key: string,
    body: Buffer,
    options?: { contentType?: string; metadata?: Record<string, string> },
  ): Promise<void>;
  get(bucket: string, key: string): Promise<Buffer | null>;
  delete(bucket: string, key: string): Promise<void>;
  copy(
    sourceBucket: string,
    sourceKey: string,
    destinationBucket: string,
    destinationKey: string,
    metadata?: Record<string, string>,
  ): Promise<void>;
  list(bucket: string, prefix: string): Promise<string[]>;
};

export type S3StorageConfig = {
  endpoint?: string;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  serverSideEncryption: "AES256" | "aws:kms";
  kmsKeyId?: string;
};

function copySource(bucket: string, key: string): string {
  return `${encodeURIComponent(bucket)}/${key
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

export function createS3ObjectStore(
  config: S3StorageConfig,
  client = new S3Client({
    region: config.region,
    maxAttempts: 3,
    requestHandler: new NodeHttpHandler({
      connectionTimeout: 5_000,
      socketTimeout: 15_000,
    }),
    endpoint: config.endpoint || undefined,
    forcePathStyle: Boolean(config.endpoint),
    credentials:
      config.accessKeyId && config.secretAccessKey
        ? {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
            sessionToken: config.sessionToken,
          }
        : undefined,
  }),
): ObjectStore {
  const encryption =
    config.serverSideEncryption === "aws:kms"
      ? {
          ServerSideEncryption: "aws:kms" as const,
          SSEKMSKeyId: config.kmsKeyId,
        }
      : { ServerSideEncryption: "AES256" as const };

  return {
    async put(bucket, key, body, options) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentLength: body.length,
          ContentType: options?.contentType,
          Metadata: options?.metadata,
          ...encryption,
        }),
      );
    },
    async get(bucket, key) {
      try {
        const output = await client.send(
          new GetObjectCommand({ Bucket: bucket, Key: key }),
        );
        if (!output.Body) return null;
        return Buffer.from(await output.Body.transformToByteArray());
      } catch (error) {
        const statusCode = (
          error as { $metadata?: { httpStatusCode?: number } }
        ).$metadata?.httpStatusCode;
        if (statusCode === 404) return null;
        throw error;
      }
    },
    async delete(bucket, key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
    async copy(
      sourceBucket,
      sourceKey,
      destinationBucket,
      destinationKey,
      metadata,
    ) {
      await client.send(
        new CopyObjectCommand({
          Bucket: destinationBucket,
          Key: destinationKey,
          CopySource: copySource(sourceBucket, sourceKey),
          MetadataDirective: metadata ? "REPLACE" : "COPY",
          Metadata: metadata,
          ...encryption,
        }),
      );
    },
    async list(bucket, prefix) {
      const keys: string[] = [];
      let continuationToken: string | undefined;
      do {
        const page = await client.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
            ContinuationToken: continuationToken,
          }),
        );
        keys.push(
          ...(page.Contents ?? [])
            .map((item) => item.Key)
            .filter((key): key is string => Boolean(key)),
        );
        continuationToken = page.IsTruncated
          ? page.NextContinuationToken
          : undefined;
      } while (continuationToken);
      return keys;
    },
  };
}

/**
 * Filesystem-backed object store for local development only. It implements the
 * same quarantine -> promote lifecycle as S3 so document saves can be exercised
 * without external infrastructure. Object metadata is intentionally not
 * persisted here; production always uses the encrypted S3 store.
 */
export function createFileSystemObjectStore(rootDir: string): ObjectStore {
  const root = path.resolve(rootDir);

  function assertSafePath(value: string, label: string): void {
    if (
      !value ||
      value.startsWith("/") ||
      value.includes("\\") ||
      value.includes("\0") ||
      value.includes("..") ||
      !/^[A-Za-z0-9._/-]+$/.test(value)
    ) {
      throw new Error(`Invalid local object ${label}.`);
    }
  }

  function resolveObject(bucket: string, key: string): string {
    assertSafePath(bucket, "bucket");
    assertSafePath(key, "key");
    return path.join(root, bucket, key);
  }

  function isMissing(error: unknown): boolean {
    return (error as NodeJS.ErrnoException).code === "ENOENT";
  }

  async function walk(
    directory: string,
    bucketRoot: string,
  ): Promise<string[]> {
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (isMissing(error)) return [];
      throw error;
    }
    const keys: string[] = [];
    for (const entry of entries) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        keys.push(...(await walk(full, bucketRoot)));
      } else if (entry.isFile()) {
        keys.push(path.relative(bucketRoot, full).split(path.sep).join("/"));
      }
    }
    return keys;
  }

  return {
    async put(bucket, key, body) {
      const target = resolveObject(bucket, key);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, body);
    },
    async get(bucket, key) {
      try {
        return await fs.readFile(resolveObject(bucket, key));
      } catch (error) {
        if (isMissing(error)) return null;
        throw error;
      }
    },
    async delete(bucket, key) {
      try {
        await fs.unlink(resolveObject(bucket, key));
      } catch (error) {
        if (!isMissing(error)) throw error;
      }
    },
    async copy(sourceBucket, sourceKey, destinationBucket, destinationKey) {
      const body = await fs.readFile(resolveObject(sourceBucket, sourceKey));
      const target = resolveObject(destinationBucket, destinationKey);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, body);
    },
    async list(bucket, prefix) {
      assertSafePath(bucket, "bucket");
      assertSafePath(prefix, "prefix");
      const bucketRoot = path.join(root, bucket);
      const keys = await walk(bucketRoot, bucketRoot);
      return keys.filter((key) => key.startsWith(prefix)).sort();
    },
  };
}

let cached: {
  store: ObjectStore;
  bucket: string;
  backupBucket: string;
} | null = null;

export function getPrivateObjectStorage() {
  if (cached) return cached;

  const driver = process.env.STORAGE_DRIVER?.trim() || "s3";
  if (driver === "local") {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Local object storage is not allowed in production; configure S3.",
      );
    }
    const localDir = process.env.STORAGE_LOCAL_DIR?.trim() || ".data/storage";
    const bucket = process.env.STORAGE_BUCKET?.trim() || "documents";
    const backupBucket = process.env.STORAGE_BACKUP_BUCKET?.trim() || "backups";
    if (bucket === backupBucket) {
      throw new Error("The document and backup buckets must be different.");
    }
    cached = {
      store: createFileSystemObjectStore(
        path.resolve(/* turbopackIgnore: true */ process.cwd(), localDir),
      ),
      bucket,
      backupBucket,
    };
    return cached;
  }
  if (driver !== "s3") {
    throw new Error("STORAGE_DRIVER must be 's3' or 'local'.");
  }

  const region = process.env.STORAGE_REGION?.trim();
  const bucket = process.env.STORAGE_BUCKET?.trim();
  const backupBucket = process.env.STORAGE_BACKUP_BUCKET?.trim();
  const endpoint = process.env.STORAGE_ENDPOINT?.trim();
  const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY?.trim();
  const serverSideEncryption =
    process.env.STORAGE_SERVER_SIDE_ENCRYPTION?.trim() || "AES256";
  const kmsKeyId = process.env.STORAGE_KMS_KEY_ID?.trim();

  if (!region || !bucket || !backupBucket) {
    throw new Error(
      "Private object storage requires STORAGE_REGION, STORAGE_BUCKET, and STORAGE_BACKUP_BUCKET.",
    );
  }
  if (bucket === backupBucket) {
    throw new Error("The document and backup buckets must be different.");
  }
  if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
    throw new Error(
      "Set both STORAGE_ACCESS_KEY_ID and STORAGE_SECRET_ACCESS_KEY, or neither to use the provider credential chain.",
    );
  }
  if (serverSideEncryption !== "AES256" && serverSideEncryption !== "aws:kms") {
    throw new Error(
      "STORAGE_SERVER_SIDE_ENCRYPTION must be AES256 or aws:kms.",
    );
  }
  if (serverSideEncryption === "aws:kms" && !kmsKeyId) {
    throw new Error("STORAGE_KMS_KEY_ID is required when using aws:kms.");
  }
  if (endpoint) {
    const parsedEndpoint = new URL(endpoint);
    if (
      parsedEndpoint.protocol !== "https:" &&
      parsedEndpoint.hostname !== "localhost" &&
      parsedEndpoint.hostname !== "127.0.0.1"
    ) {
      throw new Error(
        "STORAGE_ENDPOINT must use HTTPS except for local development.",
      );
    }
  }

  cached = {
    store: createS3ObjectStore({
      endpoint,
      region,
      accessKeyId,
      secretAccessKey,
      sessionToken: process.env.STORAGE_SESSION_TOKEN?.trim(),
      serverSideEncryption,
      kmsKeyId,
    }),
    bucket,
    backupBucket,
  };
  return cached;
}

export function resetPrivateObjectStorageForTests(): void {
  cached = null;
}
