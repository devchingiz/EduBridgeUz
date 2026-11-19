"use server";

import { revalidatePath } from "next/cache";

import { errorState, successState, type FormState } from "@/lib/actions/state";
import { requireWorkspace } from "@/lib/auth/dal";
import { setCatalogFavorite } from "@/lib/catalog/favorites";
import { assertSameOrigin } from "@/lib/http/request";

const ENTITY_TYPES = ["UNIVERSITY", "SCHOLARSHIP"] as const;
type FavoriteEntityType = (typeof ENTITY_TYPES)[number];

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function isEntityType(value: string): value is FavoriteEntityType {
  return (ENTITY_TYPES as readonly string[]).includes(value);
}

function validReturnPath(value: string): boolean {
  return (
    /^[a-z0-9/-]+$/.test(value) &&
    [
      "/universities",
      "/scholarships",
      "/dashboard/favorites",
      "/dashboard/universities",
    ].some((base) => value === base || value.startsWith(`${base}/`))
  );
}

export async function setCatalogFavoriteAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertSameOrigin();
  const { user } = await requireWorkspace();

  const entityType = text(formData, "entityType");
  const id = text(formData, "id");
  const intent = text(formData, "intent");
  const returnTo = text(formData, "returnTo");

  if (
    !isEntityType(entityType) ||
    !id ||
    !["save", "remove"].includes(intent) ||
    !validReturnPath(returnTo)
  ) {
    return errorState("That favorite could not be updated.");
  }

  const result = await setCatalogFavorite(
    user.id,
    entityType,
    id,
    intent === "save",
  );
  if (!result.ok) return errorState(result.message);

  revalidatePath(returnTo);
  return successState(
    intent === "save"
      ? "Added to your favorites."
      : "Removed from your favorites.",
  );
}
