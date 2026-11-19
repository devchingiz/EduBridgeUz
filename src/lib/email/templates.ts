/**
 * Transactional email templates.
 *
 * Every interpolated value is HTML-escaped. Emails deliberately contain a
 * single call to action and never include passwords or profile details.
 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type Template = { subject: string; text: string; html: string };

function layout(options: {
  heading: string;
  body: string[];
  actionLabel: string;
  actionUrl: string;
  footer: string;
}): string {
  const paragraphs = options.body
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#334155;">${paragraph}</p>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:32px 16px;background:#f6f7fb;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;">
      <tr>
        <td style="padding:32px;">
          <p style="margin:0 0 24px;font-size:13px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#4f46e5;">EduBridge</p>
          <h1 style="margin:0 0 16px;font-size:22px;line-height:30px;color:#0f172a;">${options.heading}</h1>
          ${paragraphs}
          <p style="margin:24px 0;">
            <a href="${options.actionUrl}" style="display:inline-block;border-radius:10px;background:#4f46e5;padding:12px 20px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${options.actionLabel}</a>
          </p>
          <p style="margin:0 0 8px;font-size:12px;line-height:20px;color:#64748b;">If the button does not work, copy this link into your browser:</p>
          <p style="margin:0 0 24px;font-size:12px;line-height:20px;color:#4f46e5;word-break:break-all;">${options.actionUrl}</p>
          <p style="margin:0;border-top:1px solid #e2e8f0;padding-top:16px;font-size:12px;line-height:20px;color:#64748b;">${options.footer}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function verificationEmail(input: {
  name: string;
  url: string;
}): Template {
  const name = escapeHtml(input.name);
  return {
    subject: "Verify your EduBridge email address",
    text: `Hi ${input.name},\n\nConfirm your email address to finish creating your EduBridge account:\n${input.url}\n\nThis link expires in 24 hours. If you did not create an account, you can ignore this email.`,
    html: layout({
      heading: `Welcome, ${name}`,
      body: [
        "Confirm your email address to finish creating your EduBridge account.",
        "This link expires in 24 hours and can be used once.",
      ],
      actionLabel: "Verify email",
      actionUrl: input.url,
      footer:
        "If you did not create an EduBridge account, you can safely ignore this email.",
    }),
  };
}

export function passwordResetEmail(input: {
  name: string;
  url: string;
}): Template {
  const name = escapeHtml(input.name);
  return {
    subject: "Reset your EduBridge password",
    text: `Hi ${input.name},\n\nUse this link to choose a new password:\n${input.url}\n\nThis link expires in 30 minutes and can be used once. If you did not request a reset, ignore this email and consider changing your password.`,
    html: layout({
      heading: "Reset your password",
      body: [
        `Hi ${name}, use the button below to choose a new password.`,
        "This link expires in 30 minutes and can be used once. Resetting your password signs you out of all other devices.",
      ],
      actionLabel: "Choose a new password",
      actionUrl: input.url,
      footer:
        "If you did not request this, you can ignore this email. Your password has not changed.",
    }),
  };
}

export function guardianConsentEmail(input: {
  guardianName: string;
  studentName: string;
  url: string;
}): Template {
  const guardianName = escapeHtml(input.guardianName);
  const studentName = escapeHtml(input.studentName);
  return {
    subject: `Guardian consent requested for ${input.studentName}'s EduBridge account`,
    text: `Hello ${input.guardianName},\n\n${input.studentName} is under 18 and has asked to use EduBridge, a university and scholarship planning tool. We need your consent before their workspace is unlocked.\n\nReview the request:\n${input.url}\n\nEduBridge never asks for payment details from students. If you were not expecting this email, you can ignore it.`,
    html: layout({
      heading: "Guardian consent requested",
      body: [
        `Hello ${guardianName}, ${studentName} is under 18 and has asked to use EduBridge, a university and scholarship planning tool.`,
        "We need your consent before their workspace is unlocked. The link below explains what is stored and lets you approve or decline.",
      ],
      actionLabel: "Review the request",
      actionUrl: input.url,
      footer:
        "If you were not expecting this email, you can ignore it. EduBridge never asks students for payment details.",
    }),
  };
}

export function accountExistsEmail(input: {
  name: string;
  url: string;
}): Template {
  const name = escapeHtml(input.name);
  return {
    subject: "You already have an EduBridge account",
    text: `Hi ${input.name},\n\nSomeone tried to create an EduBridge account with this email address. You already have one. Sign in here:\n${input.url}\n\nIf this was not you, no action is needed.`,
    html: layout({
      heading: "You already have an account",
      body: [
        `Hi ${name}, someone tried to create an EduBridge account with this email address.`,
        "You can sign in with your existing password. If you have forgotten it, use the password reset link on the sign-in page.",
      ],
      actionLabel: "Go to sign in",
      actionUrl: input.url,
      footer: "If this was not you, no action is needed.",
    }),
  };
}

export function passwordChangedEmail(input: {
  name: string;
  url: string;
}): Template {
  const name = escapeHtml(input.name);
  return {
    subject: "Your EduBridge password was changed",
    text: `Hi ${input.name},\n\nYour password was changed and all other sessions were signed out. If this was not you, reset your password immediately and contact support.`,
    html: layout({
      heading: "Your password was changed",
      body: [
        `Hi ${name}, your password was changed and all other sessions were signed out.`,
        "If this was not you, reset your password immediately.",
      ],
      actionLabel: "Open EduBridge",
      actionUrl: input.url,
      footer: "This is a security notification.",
    }),
  };
}
