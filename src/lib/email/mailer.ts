import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import nodemailer, { type Transporter } from "nodemailer";

import { getEmailConfig, getEmailFrom } from "@/lib/env";
import { logInfo } from "@/lib/observability/logger";

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
  tag: string;
};

let transporter: Transporter | undefined;

function getTransporter(): Transporter {
  const config = getEmailConfig();
  if (config.transport !== "smtp") {
    throw new Error("SMTP transport requested but not configured.");
  }

  transporter ??= nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    connectionTimeout: 5_000,
    greetingTimeout: 5_000,
    socketTimeout: 10_000,
    auth:
      config.user && config.password
        ? { user: config.user, pass: config.password }
        : undefined,
  });

  return transporter;
}

/**
 * Development transport: writes each message to `.data/mail/` so verification
 * and reset links can be inspected without an SMTP server. Never enabled in
 * production (see `getEmailConfig`).
 */
async function writeToOutbox(message: MailMessage): Promise<void> {
  const directory = path.join(process.cwd(), ".data", "mail");
  await fs.mkdir(directory, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeRecipient = message.to.replace(/[^a-z0-9@._-]/gi, "_");
  const file = path.join(
    directory,
    `${stamp}-${message.tag}-${safeRecipient}.json`,
  );

  await fs.writeFile(
    file,
    JSON.stringify(
      {
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        tag: message.tag,
        createdAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf8",
  );

  logInfo("email.console_outbox_written", { tag: message.tag });
}

export async function sendMail(message: MailMessage): Promise<void> {
  const config = getEmailConfig();

  if (config.transport === "console") {
    await writeToOutbox(message);
    return;
  }

  await getTransporter().sendMail({
    from: getEmailFrom(),
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}
