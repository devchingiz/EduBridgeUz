"use client";

import { ShieldCheck, Smartphone } from "lucide-react";
import { useActionState } from "react";

import { FormField } from "@/components/auth/form-field";
import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  beginMfaEnrollmentAction,
  confirmMfaEnrollmentAction,
  disableMfaAction,
  initialMfaState,
} from "./actions";

export function MfaSettings({
  enabled,
  enabledAt,
  recoveryCodesRemaining,
}: {
  enabled: boolean;
  enabledAt: string | null;
  recoveryCodesRemaining: number;
}) {
  const [setupState, setupAction] = useActionState(
    beginMfaEnrollmentAction,
    initialMfaState,
  );
  const [confirmState, confirmAction] = useActionState(
    confirmMfaEnrollmentAction,
    initialMfaState,
  );
  const [disableState, disableAction] = useActionState(
    disableMfaAction,
    initialMfaState,
  );

  if (enabled) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1.5">
            <ShieldCheck aria-hidden="true" className="size-3.5" />
            Enabled
          </Badge>
          <span className="text-muted-foreground text-[12.5px]">
            {enabledAt ? `Since ${enabledAt}` : ""}
          </span>
        </div>
        <p className="text-muted-foreground text-[13px] leading-6">
          {recoveryCodesRemaining} unused recovery code
          {recoveryCodesRemaining === 1 ? "" : "s"} remain. Each code works
          once. Store them somewhere safe and separate from your authenticator
          device.
        </p>
        <FormMessage state={disableState} />
        <form action={disableAction} className="space-y-3" noValidate>
          <FormField
            id="disableCode"
            label="Current code or recovery code"
            error={disableState.fieldErrors?.code}
            hint="Required to disable two-factor authentication."
          >
            <Input
              id="disableCode"
              name="code"
              autoComplete="one-time-code"
              maxLength={64}
              required
              aria-invalid={Boolean(disableState.fieldErrors?.code)}
            />
          </FormField>
          <SubmitButton variant="outline" pendingLabel="Disabling…">
            Disable two-factor authentication
          </SubmitButton>
        </form>
      </div>
    );
  }

  // Pending enrollment: the plaintext secret and codes are shown only in the
  // response to this user's own action. They are not stored, logged, or sent in
  // a URL, and a refresh requires starting enrollment again.
  if (setupState.secret) {
    return (
      <div className="space-y-5">
        <FormMessage state={setupState} />
        <div className="rounded-lg border border-amber-300/70 bg-amber-50/70 p-4 text-[13px] leading-6 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          Save these codes now. They will not be shown again, and each works
          once if you lose your authenticator device.
        </div>
        <div className="space-y-2">
          <p className="text-[13px] font-medium">Authenticator secret</p>
          <code className="bg-muted block rounded-md p-3 font-mono text-[12.5px] break-all">
            {setupState.secret}
          </code>
          <p className="text-muted-foreground text-[12px] leading-5">
            Enter this manually in your authenticator app, or paste the
            provisioning URI below if your app supports it.
          </p>
          <code className="bg-muted block rounded-md p-3 font-mono text-[11.5px] break-all">
            {setupState.provisioningUri}
          </code>
        </div>
        <div className="space-y-2">
          <p className="text-[13px] font-medium">Recovery codes</p>
          <ul className="bg-muted grid gap-1 rounded-md p-3 font-mono text-[12.5px] sm:grid-cols-2">
            {setupState.recoveryCodes?.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
        </div>
        <FormMessage state={confirmState} />
        <form action={confirmAction} className="space-y-3" noValidate>
          <FormField
            id="confirmCode"
            label="Code from your authenticator"
            error={confirmState.fieldErrors?.code}
          >
            <Input
              id="confirmCode"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              aria-invalid={Boolean(confirmState.fieldErrors?.code)}
            />
          </FormField>
          <SubmitButton pendingLabel="Enabling…">
            Enable two-factor
          </SubmitButton>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-[13px] leading-6">
        Add a second step to sign-in with an authenticator app. You will receive
        one-time recovery codes in case you lose your device.
      </p>
      <FormMessage state={setupState} />
      <form action={setupAction}>
        <Button type="submit" variant="outline">
          <Smartphone aria-hidden="true" className="size-4" />
          Set up two-factor authentication
        </Button>
      </form>
    </div>
  );
}
