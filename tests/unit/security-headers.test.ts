import { afterEach, describe, expect, it, vi } from "vitest";

type HeaderRule = {
  source: string;
  headers: Array<{ key: string; value: string }>;
};

async function globalHeaders(): Promise<HeaderRule[]> {
  vi.resetModules();
  const { default: config } = await import("../../next.config");
  const headers = config.headers as unknown as () => Promise<HeaderRule[]>;
  return headers();
}

function csp(rules: HeaderRule[]): string {
  const global = rules.find((rule) => rule.source === "/:path*");
  const header = global?.headers.find(
    (entry) => entry.key === "Content-Security-Policy",
  );
  if (!header) throw new Error("Content-Security-Policy header is missing");
  return header.value;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("security headers", () => {
  it("sets an enforcing CSP with no plugin or framing sources", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const rules = await globalHeaders();
    const policy = csp(rules);

    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("form-action 'self' https://accounts.google.com");
    expect(policy).toContain("connect-src 'self'");
    expect(policy).not.toContain("'unsafe-eval'");
  });

  it("keeps the Next.js development eval allowance out of production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(csp(await globalHeaders())).toContain("'unsafe-eval'");
  });

  it("still sends the existing baseline and token-page referrer overrides", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const rules = await globalHeaders();
    const global = rules.find((rule) => rule.source === "/:path*");
    const keys = global?.headers.map((entry) => entry.key) ?? [];

    expect(keys).toEqual(
      expect.arrayContaining([
        "X-Content-Type-Options",
        "X-Frame-Options",
        "Referrer-Policy",
        "Permissions-Policy",
        "Content-Security-Policy",
        "Strict-Transport-Security",
      ]),
    );

    for (const source of [
      "/verify-email/:path*",
      "/reset-password/:path*",
      "/guardian-consent/:path*",
    ]) {
      expect(
        rules
          .find((rule) => rule.source === source)
          ?.headers.some(
            (entry) =>
              entry.key === "Referrer-Policy" && entry.value === "no-referrer",
          ),
      ).toBe(true);
    }
  });
});
