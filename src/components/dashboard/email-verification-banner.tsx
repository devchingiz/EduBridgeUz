import { ShieldAlert } from "lucide-react";

import { ResendVerificationForm } from "@/components/auth/resend-verification-form";
import { Alert } from "@/components/ui/alert";

/**
 * Rendered from the shared dashboard shell for users whose email is still
 * unverified. Visibility is derived directly from User.emailVerifiedAt by the
 * server; this component never makes an authorization decision.
 */
export function EmailVerificationBanner() {
  return (
    <div className="border-b border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20">
      <Alert
        variant="warning"
        className="mx-auto max-w-5xl flex-col items-start gap-3 rounded-none border-0 bg-transparent px-4 py-3 text-amber-950 sm:flex-row sm:items-center sm:px-6 lg:px-8 dark:text-amber-100"
      >
        <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">Email verification pending</p>
          <p className="text-[12.5px] leading-5 opacity-90">
            Open the verification link we sent to your email to finish setting
            up your account. Your dashboard stays available while it is pending.
          </p>
        </div>
        <ResendVerificationForm
          label="Resend verification email"
          className="w-full shrink-0 sm:w-56"
        />
      </Alert>
    </div>
  );
}
