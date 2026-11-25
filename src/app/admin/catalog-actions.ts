"use server";

import { revalidatePath } from "next/cache";

import type { CatalogStatusAction } from "@/lib/admin/catalog-management";
import { catalogRevalidationPaths } from "@/lib/admin/catalog-management";
import { formDataBoolean } from "@/lib/admin/catalog-validation";
import {
  applyUniversityStatusAction,
  createAdminUniversity,
  importUniversitiesCsv,
  setUniversityFeatured,
  updateAdminUniversity,
  verifyUniversitySource,
} from "@/lib/admin/university-management";
import {
  applyScholarshipStatusAction,
  createAdminScholarship,
  importScholarshipsCsv,
  setScholarshipFeatured,
  updateAdminScholarship,
  verifyScholarshipSource,
} from "@/lib/admin/scholarship-management";
import { errorState, successState, type FormState } from "@/lib/actions/state";
import { requireAdminPermission } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { assertSameOrigin, getRequestContext } from "@/lib/http/request";

const MAX_CSV_BYTES = 512 * 1024;

const STATUS_ACTIONS: readonly CatalogStatusAction[] = [
  "PUBLISH",
  "UNPUBLISH",
  "ARCHIVE",
  "RESTORE",
];

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function universityFields(formData: FormData) {
  return {
    name: text(formData, "name"),
    slug: text(formData, "slug"),
    shortName: text(formData, "shortName"),
    city: text(formData, "city"),
    countryCode: text(formData, "countryCode"),
    websiteUrl: text(formData, "websiteUrl"),
    continent: text(formData, "continent"),
    institutionType: text(formData, "institutionType"),
    logoUrl: text(formData, "logoUrl"),
    description: text(formData, "description"),
    rankingOrganization: text(formData, "rankingOrganization"),
    rankingEdition: text(formData, "rankingEdition"),
    rankingPosition: text(formData, "rankingPosition"),
    rankingDisplay: text(formData, "rankingDisplay"),
    rankingTied: formDataBoolean(formData.get("rankingTied")),
    rankingIsRange: formDataBoolean(formData.get("rankingIsRange")),
    qsNid: text(formData, "qsNid"),
  };
}

function scholarshipFields(formData: FormData) {
  return {
    name: text(formData, "name"),
    slug: text(formData, "slug"),
    providerName: text(formData, "providerName"),
    providerUrl: text(formData, "providerUrl"),
    hostCountryCode: text(formData, "hostCountryCode"),
    fundingType: text(formData, "fundingType"),
    degreeLevels: formData
      .getAll("degreeLevels")
      .map((value) => String(value))
      .filter(Boolean),
    nationalityScope: text(formData, "nationalityScope"),
    eligibleNationalities: formData
      .getAll("eligibleNationalities")
      .map((value) => String(value))
      .filter(Boolean),
    fieldScope: text(formData, "fieldScope"),
    fields: text(formData, "fields"),
    summary: text(formData, "summary"),
  };
}

function sourceFields(formData: FormData) {
  return {
    url: text(formData, "sourceUrl"),
    publisher: text(formData, "sourcePublisher"),
    title: text(formData, "sourceTitle"),
    accessedAt: text(formData, "sourceAccessedAt"),
    verifiedAt: text(formData, "sourceVerifiedAt"),
    notes: text(formData, "sourceNotes"),
  };
}

async function refreshUniversity(id?: string): Promise<void> {
  const slug = id
    ? (
        await db.university.findUnique({
          where: { id },
          select: { slug: true },
        })
      )?.slug
    : undefined;
  for (const path of catalogRevalidationPaths("UNIVERSITY", slug)) {
    revalidatePath(path);
  }
}

async function refreshScholarship(id?: string): Promise<void> {
  const slug = id
    ? (
        await db.scholarship.findUnique({
          where: { id },
          select: { slug: true },
        })
      )?.slug
    : undefined;
  for (const path of catalogRevalidationPaths("SCHOLARSHIP", slug)) {
    revalidatePath(path);
  }
}

function resultMessage(result: {
  ok: false;
  message: string;
  fieldErrors?: Record<string, string>;
}): FormState {
  return errorState(result.message, result.fieldErrors);
}

export async function saveUniversityAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertSameOrigin();
  const context = await requireAdminPermission("UNIVERSITIES_MANAGE");
  const id = text(formData, "id");
  const publish = formDataBoolean(formData.get("publish"));
  const request = await getRequestContext();

  const result = id
    ? await updateAdminUniversity({
        id,
        fields: universityFields(formData),
        source: sourceFields(formData),
        publish,
        actorId: context.user.id,
        ip: request.ip,
      })
    : await createAdminUniversity({
        fields: universityFields(formData),
        source: sourceFields(formData),
        publish,
        actorId: context.user.id,
        ip: request.ip,
      });

  if (!result.ok) return resultMessage(result);
  await refreshUniversity(result.id);
  return successState(id ? "University profile saved." : "University created.");
}

export async function changeUniversityStatusAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertSameOrigin();
  const context = await requireAdminPermission("UNIVERSITIES_MANAGE");
  const id = text(formData, "id");
  const requested = text(formData, "action") as CatalogStatusAction;
  if (!id || !STATUS_ACTIONS.includes(requested)) {
    return errorState("Choose a valid status action.");
  }

  const request = await getRequestContext();
  const result = await applyUniversityStatusAction({
    id,
    action: requested,
    note: text(formData, "note"),
    actorId: context.user.id,
    ip: request.ip,
  });
  if (!result.ok) return resultMessage(result);

  await refreshUniversity(id);
  return successState(
    `${requested.toLowerCase().replaceAll("_", " ")} completed.`,
  );
}

export async function setUniversityFeaturedAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertSameOrigin();
  const context = await requireAdminPermission("UNIVERSITIES_MANAGE");
  const id = text(formData, "id");
  if (!id) return errorState("Choose a university.");

  const request = await getRequestContext();
  const result = await setUniversityFeatured({
    id,
    featured: formDataBoolean(formData.get("featured")),
    actorId: context.user.id,
    ip: request.ip,
  });
  if (!result.ok) return resultMessage(result);

  await refreshUniversity(id);
  return successState(
    result.warning ??
      (formDataBoolean(formData.get("featured"))
        ? "University featured in public discovery."
        : "University removed from featured discovery."),
  );
}

export async function verifyUniversitySourceAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertSameOrigin();
  const context = await requireAdminPermission("UNIVERSITIES_MANAGE");
  const id = text(formData, "id");
  const verifiedAt = text(formData, "verifiedAt");
  if (!id || !verifiedAt) return errorState("Enter a verification date.");

  const request = await getRequestContext();
  const result = await verifyUniversitySource({
    id,
    verifiedAt,
    accessedAt: text(formData, "accessedAt") || null,
    actorId: context.user.id,
    ip: request.ip,
  });
  if (!result.ok) return resultMessage(result);

  await refreshUniversity(id);
  return successState("Primary source verification recorded.");
}

export async function importUniversitiesCsvAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertSameOrigin();
  const context = await requireAdminPermission("UNIVERSITIES_MANAGE");
  const file = formData.get("csv");
  if (!(file instanceof File) || file.size === 0) {
    return errorState("Choose a CSV file.");
  }
  if (file.size > MAX_CSV_BYTES) {
    return errorState("The CSV must be smaller than 512 KiB.");
  }

  const request = await getRequestContext();
  const outcome = await importUniversitiesCsv({
    csv: await file.text(),
    actorId: context.user.id,
    ip: request.ip,
  });
  if (outcome.created > 0) await refreshUniversity();

  if (outcome.errors.length > 0) {
    return errorState(
      `${outcome.created} row(s) imported. ${outcome.errors.slice(0, 3).join(" ")}`,
    );
  }
  return successState(`Imported ${outcome.created} universities.`);
}

export async function saveScholarshipAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertSameOrigin();
  const context = await requireAdminPermission("SCHOLARSHIPS_MANAGE");
  const id = text(formData, "id");
  const publish = formDataBoolean(formData.get("publish"));
  const request = await getRequestContext();

  const result = id
    ? await updateAdminScholarship({
        id,
        fields: scholarshipFields(formData),
        source: sourceFields(formData),
        publish,
        actorId: context.user.id,
        ip: request.ip,
      })
    : await createAdminScholarship({
        fields: scholarshipFields(formData),
        source: sourceFields(formData),
        publish,
        actorId: context.user.id,
        ip: request.ip,
      });

  if (!result.ok) return resultMessage(result);
  await refreshScholarship(result.id);
  return successState(
    id ? "Scholarship profile saved." : "Scholarship created.",
  );
}

export async function changeScholarshipStatusAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertSameOrigin();
  const context = await requireAdminPermission("SCHOLARSHIPS_MANAGE");
  const id = text(formData, "id");
  const requested = text(formData, "action") as CatalogStatusAction;
  if (!id || !STATUS_ACTIONS.includes(requested)) {
    return errorState("Choose a valid status action.");
  }

  const request = await getRequestContext();
  const result = await applyScholarshipStatusAction({
    id,
    action: requested,
    note: text(formData, "note"),
    actorId: context.user.id,
    ip: request.ip,
  });
  if (!result.ok) return resultMessage(result);

  await refreshScholarship(id);
  return successState(
    `${requested.toLowerCase().replaceAll("_", " ")} completed.`,
  );
}

export async function setScholarshipFeaturedAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertSameOrigin();
  const context = await requireAdminPermission("SCHOLARSHIPS_MANAGE");
  const id = text(formData, "id");
  if (!id) return errorState("Choose a scholarship.");

  const request = await getRequestContext();
  const featured = formDataBoolean(formData.get("featured"));
  const result = await setScholarshipFeatured({
    id,
    featured,
    actorId: context.user.id,
    ip: request.ip,
  });
  if (!result.ok) return resultMessage(result);

  await refreshScholarship(id);
  return successState(
    result.warning ??
      (featured
        ? "Scholarship featured in public discovery."
        : "Scholarship removed from featured discovery."),
  );
}

export async function verifyScholarshipSourceAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertSameOrigin();
  const context = await requireAdminPermission("SCHOLARSHIPS_MANAGE");
  const id = text(formData, "id");
  const verifiedAt = text(formData, "verifiedAt");
  if (!id || !verifiedAt) return errorState("Enter a verification date.");

  const request = await getRequestContext();
  const result = await verifyScholarshipSource({
    id,
    verifiedAt,
    accessedAt: text(formData, "accessedAt") || null,
    actorId: context.user.id,
    ip: request.ip,
  });
  if (!result.ok) return resultMessage(result);

  await refreshScholarship(id);
  return successState("Primary source verification recorded.");
}

export async function importScholarshipsCsvAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertSameOrigin();
  const context = await requireAdminPermission("SCHOLARSHIPS_MANAGE");
  const file = formData.get("csv");
  if (!(file instanceof File) || file.size === 0) {
    return errorState("Choose a CSV file.");
  }
  if (file.size > MAX_CSV_BYTES) {
    return errorState("The CSV must be smaller than 512 KiB.");
  }

  const request = await getRequestContext();
  const outcome = await importScholarshipsCsv({
    csv: await file.text(),
    actorId: context.user.id,
    ip: request.ip,
  });
  if (outcome.created > 0) await refreshScholarship();

  if (outcome.errors.length > 0) {
    return errorState(
      `${outcome.created} row(s) imported. ${outcome.errors.slice(0, 3).join(" ")}`,
    );
  }
  return successState(`Imported ${outcome.created} scholarships.`);
}
