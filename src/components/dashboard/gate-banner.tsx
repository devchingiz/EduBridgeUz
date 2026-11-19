import { ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { WorkspaceStatus } from "@/lib/auth/dal";

export function GateBanner({ status }: { status: WorkspaceStatus }) {
  if (status.canUseWorkspace) return null;

  return (
    <div>
      {status.guardianConsentRequired ? (
        <Alert
          variant="warning"
          className="flex-col gap-3 sm:flex-row sm:items-center"
        >
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Guardian consent is still pending</p>
            <p className="mt-0.5 text-[12.5px] opacity-80">
              Your workspace stays locked until a parent or guardian approves.
            </p>
          </div>
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link href="/dashboard/guardian-consent">Manage consent</Link>
          </Button>
        </Alert>
      ) : null}
    </div>
  );
}
