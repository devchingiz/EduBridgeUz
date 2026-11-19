import { describe, expect, it } from "vitest";

import { executeAdvisorTool, getAdvisorToolSpecs } from "@/lib/advisor/tools";

describe("advisor tools", () => {
  it("exposes read-only tool schemas without a userId parameter", () => {
    const specs = getAdvisorToolSpecs();

    expect(specs.length).toBeGreaterThanOrEqual(8);
    expect(specs.map((spec) => spec.name)).toContain("get_student_overview");
    expect(specs.map((spec) => spec.name)).toContain("search_universities");
    expect(specs.map((spec) => spec.name)).toContain("classify_shortlist");
    expect(
      specs.find((spec) => spec.name === "classify_shortlist")?.description,
    ).toMatch(/planning estimates/i);
    expect(JSON.stringify(specs)).not.toContain('"userId"');
  });

  it("rejects unknown tools", async () => {
    const result = await executeAdvisorTool("user-1", "delete_all_users", "{}");

    expect(result.data).toMatchObject({ error: "unknown_tool" });
    expect(result.sources).toEqual([]);
  });

  it("rejects injected user IDs with strict argument validation", async () => {
    const result = await executeAdvisorTool(
      "user-1",
      "get_upcoming_deadlines",
      JSON.stringify({ days: 30, userId: "another-user" }),
    );

    expect(result.data).toMatchObject({ error: "invalid_arguments" });
  });

  it("rejects malformed JSON before running a query", async () => {
    const result = await executeAdvisorTool(
      "user-1",
      "list_applications",
      "{not-json",
    );

    expect(result.data).toMatchObject({ error: "invalid_arguments" });
  });
});
