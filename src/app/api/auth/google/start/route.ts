import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { getRequestContext, hasClientIp } from "@/lib/http/request";
import { AUTH_RATE_LIMITS } from "@/lib/auth/rate-limits";
import { evaluateAgeGate, parseDateOfBirth } from "@/lib/auth/age";
import { isProduction, getAppUrl, getGoogleOAuthConfig } from "@/lib/env";
import { db } from "@/lib/db";
import { enforceRateLimits } from "@/lib/security/rate-limit";
import { logError } from "@/lib/observability/logger";
import { guardianContactSchema } from "@/lib/validation/auth";

export const runtime = "nodejs";

const STATE_COOKIE = "edubridge_google_state";
const OAUTH_TTL_SECONDS = 600;

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function authRedirect(path: string): URL {
  return new URL(path, getAppUrl());
}

function googleError(intent: "SIGN_IN" | "SIGN_UP", error: string) {
  const page = intent === "SIGN_UP" ? "/register" : "/login";
  return NextResponse.redirect(
    authRedirect(`${page}?google=${encodeURIComponent(error)}`),
    303,
  );
}

function stateCookie(response: NextResponse, state: string): void {
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: OAUTH_TTL_SECONDS,
  });
}

function createAuthorizationUrl(input: {
  clientId: string;
  callbackUrl: string;
  state: string;
  codeChallenge: string;
}): URL {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.callbackUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  return url;
}

async function beginOAuth(
  intent: "SIGN_IN" | "SIGN_UP",
  details: {
    dateOfBirth: Date | null;
    guardianName: string | null;
    guardianEmail: string | null;
    termsAcceptedAt: Date | null;
  },
): Promise<Response> {
  let config;
  try {
    config = getGoogleOAuthConfig();
  } catch (error) {
    logError("auth.google_configuration_invalid", error);
    return googleError(intent, "not-configured");
  }
  if (!config) return googleError(intent, "not-configured");

  if (intent === "SIGN_UP") {
    const context = await getRequestContext();
    if (hasClientIp(context.ip)) {
      const limited = await enforceRateLimits([
        { ...AUTH_RATE_LIMITS.registerIp, identifier: context.ip },
      ]);
      if (limited) return googleError(intent, "rate-limited");
    }
  }

  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256")
    .update(verifier, "utf8")
    .digest("base64url");
  const now = new Date();

  await db.googleOAuthAttempt.deleteMany({
    where: { OR: [{ expiresAt: { lte: now } }, { usedAt: { not: null } }] },
  });
  await db.googleOAuthAttempt.create({
    data: {
      stateHash: hash(state),
      codeVerifier: verifier,
      intent,
      ...details,
      expiresAt: new Date(now.getTime() + OAUTH_TTL_SECONDS * 1000),
    },
  });

  const response = NextResponse.redirect(
    createAuthorizationUrl({
      clientId: config.clientId,
      callbackUrl: config.callbackUrl,
      state,
      codeChallenge: challenge,
    }),
    303,
  );
  stateCookie(response, state);
  return response;
}

export async function GET(_request: Request): Promise<Response> {
  return beginOAuth("SIGN_IN", {
    dateOfBirth: null,
    guardianName: null,
    guardianEmail: null,
    termsAcceptedAt: null,
  });
}

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ??
    request.headers.get("host");
  if (!origin || !host)
    return new Response("Origin required.", { status: 403 });
  try {
    if (new URL(origin).host !== host) {
      return new Response("Cross-origin request rejected.", { status: 403 });
    }
  } catch {
    return new Response("Invalid request origin.", { status: 403 });
  }

  const formData = await request.formData();
  if (formData.get("intent") !== "SIGN_UP") {
    return googleError("SIGN_UP", "invalid-request");
  }
  if (formData.get("acceptTerms") !== "on") {
    return googleError("SIGN_UP", "terms-required");
  }

  const dateOfBirth = parseDateOfBirth(
    String(formData.get("dateOfBirth") ?? ""),
  );
  if (!dateOfBirth) return googleError("SIGN_UP", "invalid-age");
  const ageGate = evaluateAgeGate(dateOfBirth);
  if (ageGate.status === "invalid" || ageGate.status === "too_young") {
    return googleError("SIGN_UP", "invalid-age");
  }

  let guardianName: string | null = null;
  let guardianEmail: string | null = null;
  if (ageGate.status === "minor") {
    const guardian = guardianContactSchema.safeParse({
      guardianName: String(formData.get("guardianName") ?? ""),
      guardianEmail: String(formData.get("guardianEmail") ?? ""),
    });
    if (!guardian.success) {
      return googleError("SIGN_UP", "guardian-required");
    }
    guardianName = guardian.data.guardianName;
    guardianEmail = guardian.data.guardianEmail;
  }

  return beginOAuth("SIGN_UP", {
    dateOfBirth,
    guardianName,
    guardianEmail,
    termsAcceptedAt: new Date(),
  });
}
