/**
 * Authentication and workspace mutation throttles.
 *
 * Sign-in counters are written only after a credential check fails; a
 * non-consuming read prevents further guesses once the limit is exhausted, so
 * the right password still works during a lockout. Registration counters are
 * applied only after server-side validation. Both use versioned scopes so stale
 * counters cannot block a current attempt. Every key is hashed before storage
 * (see `rateLimitKey`), so these tables never contain raw emails or IPs.
 */
export const AUTH_RATE_LIMITS = {
  signInEmail: {
    scope: "auth.signin.v1.email",
    limit: 10,
    windowSeconds: 900,
  },
  signInIp: {
    scope: "auth.signin.v1.ip",
    limit: 30,
    windowSeconds: 900,
  },
  registerIp: {
    scope: "auth.register.v2.ip",
    limit: 20,
    windowSeconds: 900,
  },
  registerEmail: {
    scope: "auth.register.v2.email",
    limit: 10,
    windowSeconds: 900,
  },
  forgotIp: { scope: "auth.forgot.ip", limit: 10, windowSeconds: 3600 },
  forgotEmail: { scope: "auth.forgot.email", limit: 5, windowSeconds: 3600 },
  resetIp: { scope: "auth.reset.ip", limit: 10, windowSeconds: 3600 },
  resetToken: { scope: "auth.reset.token", limit: 5, windowSeconds: 3600 },
  resendIp: { scope: "auth.resend.ip", limit: 10, windowSeconds: 3600 },
  resendUser: { scope: "auth.resend.user", limit: 5, windowSeconds: 3600 },
  guardianIp: { scope: "guardian.decision.ip", limit: 20, windowSeconds: 3600 },
  profileUser: { scope: "profile.update.user", limit: 30, windowSeconds: 3600 },
  passwordUser: {
    scope: "account.password.user",
    limit: 5,
    windowSeconds: 3600,
  },
  deleteUser: { scope: "account.delete.user", limit: 3, windowSeconds: 3600 },
  mfaVerifyIp: { scope: "auth.mfa.verify.ip", limit: 10, windowSeconds: 900 },
  mfaVerifyChallenge: {
    scope: "auth.mfa.verify.challenge",
    limit: 5,
    windowSeconds: 900,
  },
  mfaManageUser: {
    scope: "account.mfa.manage.user",
    limit: 10,
    windowSeconds: 3600,
  },
  workspaceUploadUser: {
    scope: "workspace.upload.user",
    limit: 30,
    windowSeconds: 3600,
  },
  workspaceUploadIp: {
    scope: "workspace.upload.ip",
    limit: 60,
    windowSeconds: 3600,
  },
} as const;

/**
 * Advisor throttles. Limits are read from `AI_*` configuration at request time;
 * identifiers are always the authenticated user ID (or a global constant),
 * never client-supplied text.
 */
export const ADVISOR_RATE_LIMIT_SCOPES = {
  messagesPerMinute: "advisor.message.user.minute",
  messagesPerDay: "advisor.message.user.day",
  userCostPerDay: "advisor.cost.user.day",
  globalCostPerDay: "advisor.cost.global.day",
} as const;
