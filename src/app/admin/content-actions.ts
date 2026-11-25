"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { errorState, successState, type FormState } from "@/lib/actions/state";
import {
  homepageContentFromFormData,
  HOMEPAGE_CACHE_TAG,
} from "@/lib/cms/homepage-content";
import { saveHomepageContent } from "@/lib/cms/homepage";
import { requireAdminPermission } from "@/lib/auth/dal";
import { assertSameOrigin, getRequestContext } from "@/lib/http/request";

export async function saveHomepageAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertSameOrigin();
  const context = await requireAdminPermission("CONTENT_MANAGE");
  const request = await getRequestContext();

  const result = await saveHomepageContent({
    content: homepageContentFromFormData(formData),
    actorId: context.user.id,
    ip: request.ip,
  });

  if (!result.ok) {
    return errorState(result.message, result.fieldErrors);
  }

  // Expire the cached public document immediately, then refresh the HTML for
  // the homepage and the editor that triggered the change.
  revalidateTag(HOMEPAGE_CACHE_TAG, { expire: 0 });
  revalidatePath("/");
  revalidatePath("/admin/content");
  return successState(`Homepage saved as revision ${result.revision}.`);
}
