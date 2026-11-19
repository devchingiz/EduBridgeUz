"use server";

import { revalidatePath } from "next/cache";

import { errorState, successState, type FormState } from "@/lib/actions/state";
import { requireWorkspace } from "@/lib/auth/dal";
import {
  addToComparison,
  removeFromComparison,
  setComparison,
} from "@/lib/catalog/comparison";
import { assertSameOrigin } from "@/lib/http/request";

function value(formData: FormData, key: string): string {
  const field = formData.get(key);
  return typeof field === "string" ? field.trim() : "";
}

function revalidateComparison(): void {
  revalidatePath("/dashboard/comparison");
  revalidatePath("/dashboard/universities");
}

export async function addToComparisonAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertSameOrigin();
  const session = await requireWorkspace();
  const universityId = value(formData, "universityId");
  if (!universityId) return errorState("Choose a university to compare.");

  const result = await addToComparison(session.user.id, universityId);
  if (!result.ok) return errorState(result.message);

  revalidateComparison();
  return successState("Added to your comparison shortlist.");
}

export async function removeFromComparisonAction(
  formData: FormData,
): Promise<void> {
  await assertSameOrigin();
  const session = await requireWorkspace();
  const universityId = value(formData, "universityId");
  if (!universityId) return;

  await removeFromComparison(session.user.id, universityId);
  revalidateComparison();
}

export async function setComparisonOrderAction(
  formData: FormData,
): Promise<void> {
  await assertSameOrigin();
  const session = await requireWorkspace();
  const ids = formData
    .getAll("universityId")
    .filter((id): id is string => typeof id === "string");

  const result = await setComparison(session.user.id, ids);
  if (!result.ok) return;
  revalidateComparison();
}
