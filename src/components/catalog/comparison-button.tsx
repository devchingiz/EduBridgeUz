"use client";

import { Columns3 } from "lucide-react";
import { useActionState } from "react";

import { addToComparisonAction } from "@/app/dashboard/comparison/actions";
import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { initialFormState } from "@/lib/actions/state";

/** Adds a university to the private four-item comparison shortlist. */
export function ComparisonButton({
  universityId,
  saved,
  compact = false,
}: {
  universityId: string;
  saved: boolean;
  compact?: boolean;
}) {
  const [state, formAction] = useActionState(
    addToComparisonAction,
    initialFormState,
  );

  return (
    <div className="flex flex-col items-start gap-1">
      <form action={formAction}>
        <input type="hidden" name="universityId" value={universityId} />
        <SubmitButton
          size={compact ? "icon-sm" : "sm"}
          variant={saved ? "secondary" : "outline"}
          aria-pressed={saved}
          pendingLabel="Adding…"
        >
          <Columns3 aria-hidden="true" />
          {!compact ? (saved ? "In comparison" : "Compare") : null}
          {compact ? (
            <span className="sr-only">
              {saved ? "In comparison" : "Add to comparison"}
            </span>
          ) : null}
        </SubmitButton>
      </form>
      {!compact ? <FormMessage state={state} /> : null}
      {compact && state.status === "error" ? (
        <p role="alert" className="text-[11px] text-red-600 dark:text-red-400">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
