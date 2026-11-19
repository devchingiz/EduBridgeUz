import { afterEach, describe, expect, it, vi } from "vitest";

import {
  inspectDocumentUpload,
  scanAndPromoteDocument,
} from "@/lib/workspace/storage";
import type { ObjectStore } from "@/lib/workspace/object-storage";
import { PRIVATE_DOCUMENT_MAX_BYTES } from "@/lib/workspace/constants";

const storageKey = "123e4567-e89b-12d3-a456-426614174000.pdf";

function createStore(overrides: Partial<ObjectStore> = {}) {
  const objects = new Map<string, Buffer>();
  const store: ObjectStore = {
    async put(bucket, key, body) {
      objects.set(`${bucket}/${key}`, Buffer.from(body));
    },
    async get(bucket, key) {
      return objects.get(`${bucket}/${key}`) ?? null;
    },
    async delete(bucket, key) {
      objects.delete(`${bucket}/${key}`);
    },
    async copy(sourceBucket, sourceKey, destinationBucket, destinationKey) {
      const source = objects.get(`${sourceBucket}/${sourceKey}`);
      if (!source) throw new Error("Source object does not exist.");
      objects.set(
        `${destinationBucket}/${destinationKey}`,
        Buffer.from(source),
      );
    },
    async list() {
      return [];
    },
    ...overrides,
  };
  return { store, objects };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("private document storage", () => {
  it("accepts supported content with a matching signature", async () => {
    const file = new File(["%PDF-1.7\napplication"], "application.pdf", {
      type: "application/pdf",
    });
    const accepted = await inspectDocumentUpload(file);
    expect(accepted).not.toBeNull();
    expect(accepted?.storageKey).toMatch(/^[0-9a-f-]{36}\.pdf$/);
  });

  it("rejects a spoofed MIME type and files over the size limit", async () => {
    const spoofed = new File(["not an image"], "fake.png", {
      type: "image/png",
    });
    const oversized = new File(
      [new Uint8Array(PRIVATE_DOCUMENT_MAX_BYTES + 1)],
      "large.pdf",
      { type: "application/pdf" },
    );

    expect(await inspectDocumentUpload(spoofed)).toBeNull();
    expect(await inspectDocumentUpload(oversized)).toBeNull();
  });

  it("promotes a clean upload and removes it from quarantine", async () => {
    const { store, objects } = createStore();
    const bytes = Buffer.from("%PDF-1.7\nclean");

    await expect(
      scanAndPromoteDocument(storageKey, bytes, "application/pdf", {
        store,
        bucket: "private-documents",
        scan: async () => "clean",
      }),
    ).resolves.toBe("clean");
    expect(objects.get(`private-documents/documents/${storageKey}`)).toEqual(
      bytes,
    );
    expect(objects.has(`private-documents/quarantine/${storageKey}`)).toBe(
      false,
    );
  });

  it("keeps an infected upload quarantined without promoting it", async () => {
    const { store, objects } = createStore();
    await expect(
      scanAndPromoteDocument(
        storageKey,
        Buffer.from("%PDF-1.7\ninfected"),
        "application/pdf",
        { store, bucket: "private-documents", scan: async () => "infected" },
      ),
    ).resolves.toBe("infected");
    expect(objects.has(`private-documents/quarantine/${storageKey}`)).toBe(
      true,
    );
    expect(objects.has(`private-documents/documents/${storageKey}`)).toBe(
      false,
    );
  });

  it("fails closed when the scanner is unavailable", async () => {
    const { store, objects } = createStore();
    await expect(
      scanAndPromoteDocument(
        storageKey,
        Buffer.from("%PDF-1.7\nunknown"),
        "application/pdf",
        {
          store,
          bucket: "private-documents",
          scan: async () => {
            throw new Error("scanner unavailable");
          },
        },
      ),
    ).rejects.toThrow("scanner unavailable");
    expect(objects.has(`private-documents/quarantine/${storageKey}`)).toBe(
      true,
    );
    expect(objects.has(`private-documents/documents/${storageKey}`)).toBe(
      false,
    );
  });

  it("propagates storage failures and does not scan an unpersisted upload", async () => {
    const scan = vi.fn(async () => "clean" as const);
    const { store } = createStore({
      put: async () => {
        throw new Error("storage unavailable");
      },
    });
    await expect(
      scanAndPromoteDocument(
        storageKey,
        Buffer.from("%PDF-1.7\nclean"),
        "application/pdf",
        { store, bucket: "private-documents", scan },
      ),
    ).rejects.toThrow("storage unavailable");
    expect(scan).not.toHaveBeenCalled();
  });

  it("does not promote a clean upload when the quarantine copy fails", async () => {
    const { store, objects } = createStore({
      copy: async () => {
        throw new Error("copy failed");
      },
    });
    await expect(
      scanAndPromoteDocument(
        storageKey,
        Buffer.from("%PDF-1.7\nclean"),
        "application/pdf",
        { store, bucket: "private-documents", scan: async () => "clean" },
      ),
    ).rejects.toThrow("copy failed");
    expect(objects.has(`private-documents/quarantine/${storageKey}`)).toBe(
      true,
    );
    expect(objects.has(`private-documents/documents/${storageKey}`)).toBe(
      false,
    );
  });

  it("isolates concurrent uploads under distinct private keys", async () => {
    const { store, objects } = createStore();
    const file = new File(["%PDF-1.7\nconcurrent"], "application.pdf", {
      type: "application/pdf",
    });
    const acceptedUploads = await Promise.all([
      inspectDocumentUpload(file),
      inspectDocumentUpload(file),
    ]);
    expect(acceptedUploads[0]?.storageKey).not.toBe(
      acceptedUploads[1]?.storageKey,
    );

    await Promise.all(
      acceptedUploads.map(async (accepted) => {
        if (!accepted) throw new Error("Expected valid PDF upload.");
        await scanAndPromoteDocument(
          accepted.storageKey,
          accepted.bytes,
          accepted.mimeType,
          { store, bucket: "private-documents", scan: async () => "clean" },
        );
      }),
    );
    expect(
      [...objects.keys()].filter((key) =>
        key.startsWith("private-documents/documents/"),
      ),
    ).toHaveLength(2);
  });
});
