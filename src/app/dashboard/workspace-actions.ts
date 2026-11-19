"use server";

import { ApplicationStatus, StudentDocumentCategory } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertSameOrigin } from "@/lib/http/request";
import { requireWorkspace } from "@/lib/auth/dal";
import {
  APPLICATION_STATUSES,
  DOCUMENT_CATEGORIES,
} from "@/lib/workspace/constants";
import {
  createApplication,
  deleteApplication,
  deleteDocument,
  linkDocumentToApplication,
  markNotificationRead,
  setApplicationDeadline,
  setApplicationStatus,
  setNotificationPreferences,
  updateApplication,
  updateDocument,
} from "@/lib/workspace/service";

function value(formData: FormData, key: string): string {
  const field = formData.get(key);
  return typeof field === "string" ? field.trim() : "";
}

function dateValue(value: string): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Enter a valid calendar date.");
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error("Enter a valid calendar date.");
  }
  return date;
}

function checkedStatus(value: string): ApplicationStatus {
  if (!(APPLICATION_STATUSES as readonly string[]).includes(value)) {
    throw new Error("Choose a valid application status.");
  }
  return value as ApplicationStatus;
}

function checkedCategory(value: string): StudentDocumentCategory {
  if (!(DOCUMENT_CATEGORIES as readonly string[]).includes(value)) {
    throw new Error("Choose a valid document category.");
  }
  return value as StudentDocumentCategory;
}

export async function createApplicationAction(formData: FormData) {
  await assertSameOrigin();
  const session = await requireWorkspace();
  const universityId = value(formData, "universityId");
  if (!universityId) throw new Error("Choose a university.");

  const result = await createApplication(session.user.id, {
    universityId,
    status: checkedStatus(value(formData, "status") || "INTERESTED"),
    notes: value(formData, "notes").slice(0, 5000),
    deadline: dateValue(value(formData, "deadline")),
  });
  if (!result.ok) {
    throw new Error(
      result.reason === "duplicate"
        ? "This university is already in your tracker."
        : "That university is not currently available.",
    );
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/applications");
  redirect(`/dashboard/applications/${result.id}`);
}

export async function setApplicationDeadlineAction(formData: FormData) {
  await assertSameOrigin();
  const session = await requireWorkspace();
  const universityId = value(formData, "universityId");
  const slug = value(formData, "slug");
  if (!universityId || !/^[a-z0-9-]+$/.test(slug)) {
    throw new Error("Choose a valid university.");
  }
  const deadline = dateValue(value(formData, "deadline"));
  if (!deadline) throw new Error("Choose a deadline.");

  const updated = await setApplicationDeadline(
    session.user.id,
    universityId,
    deadline,
  );
  if (!updated) throw new Error("Add this university to your tracker first.");

  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard/applications");
  revalidatePath(`/dashboard/universities/${slug}`);
  redirect(`/dashboard/universities/${slug}?deadline=added`);
}

export async function updateApplicationAction(formData: FormData) {
  await assertSameOrigin();
  const session = await requireWorkspace();
  const applicationId = value(formData, "applicationId");
  const progressValue = value(formData, "progress");
  const progress = Number(progressValue);
  if (
    !applicationId ||
    !Number.isInteger(progress) ||
    progress < 0 ||
    progress > 100
  ) {
    throw new Error("Enter application progress from 0 to 100.");
  }

  const updated = await updateApplication(session.user.id, applicationId, {
    status: checkedStatus(value(formData, "status")),
    notes: value(formData, "notes").slice(0, 5000),
    deadline: dateValue(value(formData, "deadline")),
    progress,
  });
  if (!updated) throw new Error("Application not found.");

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/applications");
  revalidatePath(`/dashboard/applications/${applicationId}`);
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard/notifications");
  redirect(`/dashboard/applications/${applicationId}`);
}

export async function setApplicationStatusAction(formData: FormData) {
  await assertSameOrigin();
  const session = await requireWorkspace();
  const applicationId = value(formData, "applicationId");
  const status = checkedStatus(value(formData, "status"));
  if (
    !applicationId ||
    !(await setApplicationStatus(session.user.id, applicationId, status))
  ) {
    throw new Error("Application not found.");
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/applications");
  revalidatePath(`/dashboard/applications/${applicationId}`);
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard/notifications");
}

export async function deleteApplicationAction(formData: FormData) {
  await assertSameOrigin();
  const session = await requireWorkspace();
  const applicationId = value(formData, "applicationId");
  if (
    !applicationId ||
    !(await deleteApplication(session.user.id, applicationId))
  ) {
    throw new Error("Application not found.");
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/applications");
  revalidatePath("/dashboard/calendar");
  redirect("/dashboard/applications");
}

export async function updateDocumentAction(formData: FormData) {
  await assertSameOrigin();
  const session = await requireWorkspace();
  const documentId = value(formData, "documentId");
  const name = value(formData, "name").slice(0, 120);
  if (!documentId || !name) throw new Error("Enter a document name.");

  const updated = await updateDocument(session.user.id, documentId, {
    name,
    category: checkedCategory(value(formData, "category")),
    isComplete: value(formData, "isComplete") === "on",
  });
  if (!updated) throw new Error("Document not found.");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/documents");
  revalidatePath("/dashboard/notifications");
  redirect("/dashboard/documents?saved=1");
}

export async function deleteDocumentAction(formData: FormData) {
  await assertSameOrigin();
  const session = await requireWorkspace();
  const documentId = value(formData, "documentId");
  if (!documentId || !(await deleteDocument(session.user.id, documentId))) {
    throw new Error("Document not found.");
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/documents");
  revalidatePath("/dashboard/notifications");
  redirect("/dashboard/documents");
}

export async function linkDocumentAction(formData: FormData) {
  await assertSameOrigin();
  const session = await requireWorkspace();
  const documentId = value(formData, "documentId");
  const applicationId = value(formData, "applicationId");
  if (
    !documentId ||
    !applicationId ||
    !(await linkDocumentToApplication(
      session.user.id,
      documentId,
      applicationId,
      value(formData, "linked") === "true",
    ))
  ) {
    throw new Error("Application or document not found.");
  }
  revalidatePath(`/dashboard/applications/${applicationId}`);
  revalidatePath("/dashboard/documents");
  redirect(`/dashboard/applications/${applicationId}`);
}

export async function saveNotificationPreferencesAction(formData: FormData) {
  await assertSameOrigin();
  const session = await requireWorkspace();
  await setNotificationPreferences(session.user.id, {
    deadlines: value(formData, "deadlines") === "on",
    applicationStatus: value(formData, "applicationStatus") === "on",
    missingDocuments: value(formData, "missingDocuments") === "on",
    scholarshipAnnouncements:
      value(formData, "scholarshipAnnouncements") === "on",
  });
  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard");
  redirect("/dashboard/notifications?saved=1");
}

export async function markNotificationReadAction(formData: FormData) {
  await assertSameOrigin();
  const session = await requireWorkspace();
  const notificationId = value(formData, "notificationId");
  if (!notificationId) throw new Error("Notification not found.");
  await markNotificationRead(session.user.id, notificationId);
  revalidatePath("/dashboard/notifications");
  redirect("/dashboard/notifications");
}
