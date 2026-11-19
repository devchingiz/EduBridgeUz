"use client";

import { Heart } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { setCatalogFavoriteAction } from "@/app/catalog-actions";
import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/lib/actions/state";

export function FavoriteButton({
  entityType,
  id,
  saved,
  signedIn,
  returnTo,
  compact = false,
}: {
  entityType: "UNIVERSITY" | "SCHOLARSHIP";
  id: string;
  saved: boolean;
  signedIn: boolean;
  returnTo: string;
  compact?: boolean;
}) {
  const [state, formAction] = useActionState(
    setCatalogFavoriteAction,
    initialFormState,
  );

  if (!signedIn) {
    return (
      <Button asChild size={compact ? "icon-sm" : "sm"} variant="ghost">
        <Link href="/login" aria-label="Sign in to save this catalog record">
          <Heart aria-hidden="true" />
          {!compact ? (
            "Sign in to save"
          ) : (
            <span className="sr-only">Sign in to save</span>
          )}
        </Link>
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <form action={formAction}>
        <input type="hidden" name="entityType" value={entityType} />
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="intent" value={saved ? "remove" : "save"} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <SubmitButton
          size={compact ? "icon-sm" : "sm"}
          variant={saved ? "secondary" : "outline"}
          aria-label={saved ? "Remove from favorites" : "Save to favorites"}
          aria-pressed={saved}
          pendingLabel="Saving…"
        >
          <Heart aria-hidden="true" className={saved ? "fill-current" : ""} />
          {!compact ? (saved ? "Saved" : "Save") : null}
          {compact ? (
            <span className="sr-only">
              {saved ? "Saved" : "Save to favorites"}
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
