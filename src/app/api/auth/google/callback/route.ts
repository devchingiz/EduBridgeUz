import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { z } from "zod";

import { getAppUrl, getGoogleOAuthConfig, isProduction } from "@/lib/env";
import { db } from "@/lib/db";
import { logError } from "@/lib/observability/logger";
import { completeGoogleSignIn } from "@/lib/auth/service";
import { setSessionCookie } from "@/lib/auth/session";
import { getRequestContext } from "@/lib/http/request";
import { safeEqual } from "@/lib/security/crypto";

export const runtime = "nodejs";

const STATE_COOKIE = "edubridge_google_state";

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
});

const userInfoSchema = z.object({
  sub: z.string().min(1).max(255),
  email: z
    .string()
    .email()
    .transform((value) => value.trim().toLowerCase()),
  email_verified: z.literal(true),
  name: z.string().trim().min(1).max(255).optional(),
});

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function authPath(intent: "SIGN_IN" | "SIGN_UP", error: string): string {
  const path = intent === "SIGN_UP" ? "/register" : "/login";
  return new URL(
    `${path}?google=${encodeURIComponent(error)}`,
    getAppUrl(),
  ).toString();
}

function clearStateCookie(): Promise<void> {
  return cookies().then((store) => {
    store.set(STATE_COOKIE, "", {
      httpOnly: true,
      secure: isProduction(),
      sameSite: "lax",
      path: "/api/auth/google",
      maxAge: 0,
    });
  });
}

async function fail(
  intent: "SIGN_IN" | "SIGN_UP",
  error: string,
): Promise<never> {
  await clearStateCookie();
  redirect(authPath(intent, error));
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code");
  const providerError = url.searchParams.get("error");
  const cookieState = (await cookies()).get(STATE_COOKIE)?.value ?? "";

  if (!state || !cookieState || !safeEqual(state, cookieState)) {
    await clearStateCookie();
    redirect(authPath("SIGN_IN", "invalid-state"));
  }

  const stateHash = hash(state);
  const attempt = await db.googleOAuthAttempt.findUnique({
    where: { stateHash },
  });
  const intent = attempt?.intent ?? "SIGN_IN";
  const consumed = await db.googleOAuthAttempt.updateMany({
    where: {
      stateHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { usedAt: new Date() },
  });
  if (!attempt) return fail(intent, "expired");
  if (consumed.count !== 1) return fail(intent, "expired");
  await clearStateCookie();

  if (providerError || !code) {
    redirect(authPath(intent, "cancelled"));
  }

  let destination: string;
  try {
    const config = getGoogleOAuthConfig();
    if (!config) {
      destination = authPath(intent, "not-configured");
    } else {
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: config.callbackUrl,
          grant_type: "authorization_code",
          code_verifier: attempt.codeVerifier,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      const tokenPayload: unknown = await tokenResponse.json();
      const parsedToken = tokenResponseSchema.safeParse(tokenPayload);
      if (!tokenResponse.ok || !parsedToken.success) {
        destination = authPath(intent, "failed");
      } else {
        const profileResponse = await fetch(
          "https://openidconnect.googleapis.com/v1/userinfo",
          {
            headers: {
              Authorization: `Bearer ${parsedToken.data.access_token}`,
            },
            cache: "no-store",
            signal: AbortSignal.timeout(10_000),
          },
        );
        const profilePayload: unknown = await profileResponse.json();
        const parsedProfile = userInfoSchema.safeParse(profilePayload);
        if (!profileResponse.ok || !parsedProfile.success) {
          destination = authPath(intent, "unverified-email");
        } else {
          const details =
            intent === "SIGN_UP" &&
            attempt.dateOfBirth &&
            attempt.termsAcceptedAt
              ? {
                  dateOfBirth: attempt.dateOfBirth,
                  termsAcceptedAt: attempt.termsAcceptedAt,
                  guardianName: attempt.guardianName,
                  guardianEmail: attempt.guardianEmail,
                }
              : null;
          const result = await completeGoogleSignIn(
            {
              subject: parsedProfile.data.sub,
              email: parsedProfile.data.email,
              name: parsedProfile.data.name,
            },
            intent,
            details,
            await getRequestContext(),
          );

          if (!result.ok) {
            destination = authPath(
              intent,
              result.reason === "account_not_found"
                ? "account-not-found"
                : "invalid-signup",
            );
          } else {
            await setSessionCookie(result.sessionToken);
            destination = result.created
              ? new URL("/dashboard?registered=1", getAppUrl()).toString()
              : new URL("/dashboard", getAppUrl()).toString();
          }
        }
      }
    }
  } catch (error) {
    logError("auth.google_callback_failed", error);
    destination = authPath(intent, "failed");
  }
  redirect(destination);
}
