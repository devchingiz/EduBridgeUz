import { describe, expect, it, vi } from "vitest";

import { removeVerificationTokenFromHistory } from "@/lib/auth/verification-url";

function fakeHistory(state: unknown = { key: "entry" }) {
  return {
    state,
    replaceState: vi.fn(),
  };
}

describe("verification token history stripping", () => {
  it("removes only the token parameter from the current history entry", () => {
    const history = fakeHistory();
    const location = {
      href: "https://edubridge.example/verify-email?token=secret-token-123&next=%2Fdashboard#details",
    };

    expect(removeVerificationTokenFromHistory(location, history)).toBe(true);
    expect(history.replaceState).toHaveBeenCalledWith(
      { key: "entry" },
      "",
      "/verify-email?next=%2Fdashboard#details",
    );

    const replacement = String(history.replaceState.mock.calls[0][2]);
    expect(replacement).not.toContain("secret-token-123");
    expect(replacement).not.toContain("token=");
  });

  it("does not change history when the URL has no token", () => {
    const history = fakeHistory(null);

    expect(
      removeVerificationTokenFromHistory(
        { href: "https://edubridge.example/verify-email" },
        history,
      ),
    ).toBe(false);
    expect(history.replaceState).not.toHaveBeenCalled();
  });

  it("ignores an unparsable URL", () => {
    const history = fakeHistory();

    expect(
      removeVerificationTokenFromHistory({ href: "not a url" }, history),
    ).toBe(false);
    expect(history.replaceState).not.toHaveBeenCalled();
  });

  it("does not write the token to console output", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const history = fakeHistory();

    try {
      removeVerificationTokenFromHistory(
        {
          href: "https://edubridge.example/verify-email?token=secret-token-123",
        },
        history,
      );
    } finally {
      log.mockRestore();
      warn.mockRestore();
      error.mockRestore();
    }

    const output = JSON.stringify([
      ...log.mock.calls,
      ...warn.mock.calls,
      ...error.mock.calls,
    ]);
    expect(output).not.toContain("secret-token-123");
  });
});
