import { Alert } from "@/components/ui/alert";

const MESSAGES: Record<string, string> = {
  "not-configured":
    "Google sign-in is not configured yet. Please use email and password for now.",
  "rate-limited": "Too many account requests. Please wait and try again.",
  "invalid-request": "We could not start Google sign-in. Please try again.",
  "terms-required": "Accept the terms and privacy notice to continue.",
  "invalid-age":
    "Enter a valid date of birth. You must be at least 13 to create an account.",
  "guardian-required":
    "Add a valid parent or guardian contact to continue with Google.",
  "invalid-state": "The Google sign-in request expired. Please try again.",
  expired: "The Google sign-in request expired. Please try again.",
  cancelled: "Google sign-in was cancelled.",
  failed: "Google sign-in could not be completed. Please try again.",
  "unverified-email":
    "Google did not confirm this email address. Choose a verified Google account.",
  "account-not-found":
    "No EduBridge account is linked to that Google account. Sign up first.",
  "invalid-signup": "We could not create your account. Check your details.",
};

export function GoogleAuthMessage({ code }: { code?: string }) {
  const message = code ? MESSAGES[code] : undefined;
  return message ? <Alert variant="error">{message}</Alert> : null;
}
