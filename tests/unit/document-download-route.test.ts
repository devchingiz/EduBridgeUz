import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireWorkspace: vi.fn(),
  getOwnedDocument: vi.fn(),
  readPrivateDocument: vi.fn(),
}));

vi.mock("@/lib/auth/dal", () => ({
  requireWorkspace: mocks.requireWorkspace,
}));
vi.mock("@/lib/workspace/service", () => ({
  getOwnedDocument: mocks.getOwnedDocument,
}));
vi.mock("@/lib/workspace/storage", () => ({
  readPrivateDocument: mocks.readPrivateDocument,
}));

import { GET } from "@/app/dashboard/documents/[documentId]/route";

describe("private document download route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireWorkspace.mockResolvedValue({ user: { id: "owner-id" } });
  });

  it("does not read bytes when the document is not owned by the caller", async () => {
    mocks.getOwnedDocument.mockResolvedValue(null);

    const response = await GET(new Request("https://example.test"), {
      params: Promise.resolve({ documentId: "another-users-document" }),
    });

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.getOwnedDocument).toHaveBeenCalledWith(
      "owner-id",
      "another-users-document",
    );
    expect(mocks.readPrivateDocument).not.toHaveBeenCalled();
  });

  it("serves owned bytes through the private proxy response", async () => {
    mocks.getOwnedDocument.mockResolvedValue({
      name: "Transcript.pdf",
      storageKey: "123e4567-e89b-12d3-a456-426614174001.pdf",
      mimeType: "application/pdf",
      sizeBytes: 12,
    });
    mocks.readPrivateDocument.mockResolvedValue(Buffer.from("%PDF-private"));

    const response = await GET(new Request("https://example.test"), {
      params: Promise.resolve({ documentId: "owned-document" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "sandbox",
    );
    expect(response.headers.get("Content-Disposition")).toContain(
      "Transcript.pdf",
    );
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe(
      "%PDF-private",
    );
  });

  it("does not serve object bytes whose size differs from owned metadata", async () => {
    mocks.getOwnedDocument.mockResolvedValue({
      name: "Transcript.pdf",
      storageKey: "123e4567-e89b-12d3-a456-426614174001.pdf",
      mimeType: "application/pdf",
      sizeBytes: 100,
    });
    mocks.readPrivateDocument.mockResolvedValue(Buffer.from("%PDF-short"));

    const response = await GET(new Request("https://example.test"), {
      params: Promise.resolve({ documentId: "owned-document" }),
    });

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Document is unavailable.");
  });
});
