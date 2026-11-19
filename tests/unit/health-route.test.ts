import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { $queryRaw: vi.fn() },
}));

import { db } from "@/lib/db";
import { GET as live } from "@/app/api/health/live/route";
import { GET as ready } from "@/app/api/health/ready/route";

describe("health endpoints", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("serves liveness without depending on the database", async () => {
    const response = live();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ status: "ok" });
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });

  it("reports readiness only when the database responds", async () => {
    vi.mocked(db.$queryRaw).mockResolvedValue([]);

    const response = await ready();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("returns a generic unavailable response when the database fails", async () => {
    vi.mocked(db.$queryRaw).mockRejectedValue(new Error("connection secret"));

    const response = await ready();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ status: "unavailable" });
  });
});
