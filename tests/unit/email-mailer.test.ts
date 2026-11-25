import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MailMessage } from "@/lib/email/mailer";

const mocks = vi.hoisted(() => ({
  createTransport: vi.fn(),
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: { createTransport: mocks.createTransport },
}));

vi.mock("@/lib/observability/logger", () => ({
  logError: mocks.logError,
  logInfo: mocks.logInfo,
  logWarn: mocks.logWarn,
}));

const EMAIL_FROM = "EduBridge <no-reply@example.test>";

const MESSAGE: MailMessage = {
  to: "amina@example.com",
  subject: "Verify your EduBridge email address",
  text: "Confirm at https://edubridge.example/verify-email?token=secret-token-123",
  html: "<p>Confirm at https://edubridge.example/verify-email?token=secret-token-123</p>",
  tag: "verify-email",
};

const PAYLOAD = {
  from: EMAIL_FROM,
  to: MESSAGE.to,
  subject: MESSAGE.subject,
  text: MESSAGE.text,
  html: MESSAGE.html,
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("EMAIL_TRANSPORT", "smtp");
  vi.stubEnv("SMTP_HOST", "smtp.example.test");
  vi.stubEnv("EMAIL_FROM", EMAIL_FROM);
  mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail });
  mocks.sendMail.mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("email delivery", () => {
  it("sends once and does not log a retry when SMTP succeeds", async () => {
    const { sendMail } = await import("@/lib/email/mailer");

    await sendMail(MESSAGE);

    expect(mocks.sendMail).toHaveBeenCalledTimes(1);
    expect(mocks.sendMail).toHaveBeenCalledWith(PAYLOAD);
    expect(mocks.logWarn).not.toHaveBeenCalled();
  });

  it("retries a transient failure with the same prepared message", async () => {
    vi.useFakeTimers();
    const { sendMail } = await import("@/lib/email/mailer");
    mocks.sendMail.mockRejectedValueOnce(
      Object.assign(new Error("connection lost"), { code: "ECONNECTION" }),
    );

    const pending = sendMail(MESSAGE);
    await vi.advanceTimersByTimeAsync(300);
    await pending;

    expect(mocks.sendMail).toHaveBeenCalledTimes(2);
    expect(mocks.sendMail).toHaveBeenNthCalledWith(1, PAYLOAD);
    expect(mocks.sendMail).toHaveBeenNthCalledWith(2, PAYLOAD);
    expect(mocks.logWarn).toHaveBeenCalledWith("email.delivery_retry", {
      tag: "verify-email",
      attempt: 1,
      delayMs: 250,
      reason: "ECONNECTION",
    });

    const logged = JSON.stringify(mocks.logWarn.mock.calls);
    expect(logged).not.toContain("secret-token-123");
    expect(logged).not.toContain("verify-email?token=");
  });

  it("stops after the retry limit and logs safe attempt metadata", async () => {
    vi.useFakeTimers();
    const { sendMail } = await import("@/lib/email/mailer");
    const failure = Object.assign(new Error("still unavailable"), {
      code: "ETIMEDOUT",
    });
    mocks.sendMail.mockRejectedValue(failure);

    const pending = sendMail(MESSAGE).catch((error) => error);
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(pending).resolves.toBe(failure);

    expect(mocks.sendMail).toHaveBeenCalledTimes(3);
    expect(mocks.logWarn).toHaveBeenCalledTimes(2);
    expect(mocks.logWarn.mock.calls[0][1]).toMatchObject({
      attempt: 1,
      delayMs: 250,
    });
    expect(mocks.logWarn.mock.calls[1][1]).toMatchObject({
      attempt: 2,
      delayMs: 500,
    });
  });

  it("does not retry a permanent authentication failure", async () => {
    const { sendMail } = await import("@/lib/email/mailer");
    const failure = Object.assign(new Error("bad credentials"), {
      code: "EAUTH",
    });
    mocks.sendMail.mockRejectedValueOnce(failure);

    await expect(sendMail(MESSAGE)).rejects.toBe(failure);

    expect(mocks.sendMail).toHaveBeenCalledTimes(1);
    expect(mocks.logWarn).not.toHaveBeenCalled();
  });

  it("does not retry after the SMTP body phase", async () => {
    const { sendMail } = await import("@/lib/email/mailer");
    const failure = Object.assign(new Error("accepted then failed"), {
      command: "DATA",
      responseCode: 451,
    });
    mocks.sendMail.mockRejectedValueOnce(failure);

    await expect(sendMail(MESSAGE)).rejects.toBe(failure);

    expect(mocks.sendMail).toHaveBeenCalledTimes(1);
    expect(mocks.logWarn).not.toHaveBeenCalled();
  });

  it("does not apply SMTP retries to the console outbox", async () => {
    vi.stubEnv("EMAIL_TRANSPORT", "console");
    const { sendMail } = await import("@/lib/email/mailer");

    await sendMail(MESSAGE);

    expect(mocks.sendMail).not.toHaveBeenCalled();
    expect(mocks.logWarn).not.toHaveBeenCalled();
    expect(mocks.logInfo).toHaveBeenCalledWith("email.console_outbox_written", {
      tag: "verify-email",
    });
  });

  it("refuses console transport in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EMAIL_TRANSPORT", "console");
    const { getEmailConfig } = await import("@/lib/env");

    expect(() => getEmailConfig()).toThrow(
      /console is not allowed in production/,
    );
  });
});
