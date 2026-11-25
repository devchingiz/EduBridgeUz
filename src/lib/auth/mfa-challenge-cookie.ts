import "server-only";

import { cookies } from "next/headers";

import { isProduction } from "@/lib/env";

export const MFA_CHALLENGE_COOKIE = "edubridge_mfa_challenge";
const MFA_CHALLENGE_MAX_AGE_SECONDS = 5 * 60;

/**
 * The challenge token is a credential: it lives only in an HttpOnly cookie so
 * it never appears in a URL, referrer, browser history, or client script.
 */
export async function setMfaChallengeCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(MFA_CHALLENGE_COOKIE, token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: MFA_CHALLENGE_MAX_AGE_SECONDS,
    priority: "high",
  });
}

export async function getMfaChallengeCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(MFA_CHALLENGE_COOKIE)?.value ?? null;
}

export async function clearMfaChallengeCookie(): Promise<void> {
  const store = await cookies();
  store.delete(MFA_CHALLENGE_COOKIE);
}
