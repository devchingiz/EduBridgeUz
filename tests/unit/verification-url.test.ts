import { describe, expect, it } from "vitest";

import {
  removePathTokenFromHistory,
  removeVerificationTokenFromHistory,
} from "@/lib/auth/verification-url";

const TOKEN = "aU9xQ2w4ZmJkV3R5c2VjcmV0MTIzNDU2Nzg5MA";

function historyMock() {
  return {
    state: { preserved: true },
    calls: [] as Array<{ state: unknown; url: string }>,
    replaceState(state: unknown, _unused: string, url: string) {
      this.calls.push({ state, url });
    },
  };
}

describe("removeVerificationTokenFromHistory", () => {
  it("removes only the token query parameter", () => {
    const history = historyMock();
    const location = {
      href: `https://edubridge.example/verify-email?token=${TOKEN}&lang=en#details`,
    };

    expect(removeVerificationTokenFromHistory(location, history)).toBe(true);
    expect(history.calls).toHaveLength(1);
    expect(history.calls[0].url).toBe("/verify-email?lang=en#details");
    expect(history.calls[0].url).not.toContain(TOKEN);
    expect(history.calls[0].state).toEqual({ preserved: true });
  });

  it("does nothing when no token is present or the URL is malformed", () => {
    const history = historyMock();
    expect(
      removeVerificationTokenFromHistory(
        { href: "https://edubridge.example/verify-email" },
        history,
      ),
    ).toBe(false);
    expect(
      removeVerificationTokenFromHistory({ href: "not a url" }, history),
    ).toBe(false);
    expect(history.calls).toHaveLength(0);
  });
});

describe("removePathTokenFromHistory", () => {
  it("replaces a high-entropy path token with the clean path", () => {
    const history = historyMock();
    const location = {
      href: `https://edubridge.example/guardian-consent/${TOKEN}?lang=en#form`,
    };

    expect(
      removePathTokenFromHistory(
        location,
        history,
        "/guardian-consent/consent",
      ),
    ).toBe(true);
    expect(history.calls[0].url).toBe("/guardian-consent/consent?lang=en#form");
    expect(history.calls[0].url).not.toContain(TOKEN);
    expect(history.calls[0].state).toEqual({ preserved: true });
  });

  it("refuses to rewrite short or non-token path segments", () => {
    const history = historyMock();
    for (const path of [
      "/guardian-consent/complete",
      "/guardian-consent/abc",
    ]) {
      expect(
        removePathTokenFromHistory(
          { href: `https://edubridge.example${path}` },
          history,
          "/guardian-consent/consent",
        ),
      ).toBe(false);
    }
    expect(history.calls).toHaveLength(0);
  });
});
