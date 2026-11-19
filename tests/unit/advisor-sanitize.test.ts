import { describe, expect, it } from "vitest";

import {
  finalizeAssistantContent,
  stripDangerousHtml,
} from "@/lib/advisor/sanitize";

const source = {
  url: "https://uni.example/admissions",
  title: "Official admissions page",
  verifiedAt: "2026-10-01",
};

describe("advisor output sanitizing", () => {
  it("keeps links to real tool sources and appends the server source block", () => {
    const result = finalizeAssistantContent(
      "See the [official page](https://uni.example/admissions) for details.",
      [source],
    );

    expect(result.content).toContain(
      "[official page](https://uni.example/admissions)",
    );
    expect(result.content).toContain("Sources from EduBridge catalog");
    expect(result.citations).toEqual([source]);
  });

  it("strips fabricated URLs and dangerous HTML", () => {
    const result = finalizeAssistantContent(
      '<script>alert("x")</script> See https://fake-university.test/tuition for tuition.',
      [source],
    );

    expect(result.content).not.toContain("<script>");
    expect(result.content).not.toContain(
      "https://fake-university.test/tuition",
    );
    expect(result.content).toContain("[unverified link removed]");
  });

  it("preserves internal application links", () => {
    const result = finalizeAssistantContent(
      "Open [your documents](/dashboard/documents).",
      [],
    );

    expect(result.content).toContain("[your documents](/dashboard/documents)");
    expect(result.citations).toEqual([]);
  });

  it("removes non-script dangerous tags", () => {
    expect(
      stripDangerousHtml('<iframe src="https://evil.test"></iframe>ok'),
    ).toBe("ok");
  });
});
