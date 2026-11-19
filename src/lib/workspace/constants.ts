import type {
  ApplicationStatus,
  StudentDocumentCategory,
  StudentNotificationType,
} from "@prisma/client";

export const APPLICATION_STATUSES = [
  "INTERESTED",
  "RESEARCHING",
  "PREPARING_DOCUMENTS",
  "READY_TO_APPLY",
  "SUBMITTED",
  "INTERVIEW",
  "ACCEPTED",
  "REJECTED",
  "WAITLISTED",
] as const satisfies readonly ApplicationStatus[];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  INTERESTED: "Interested",
  RESEARCHING: "Researching",
  PREPARING_DOCUMENTS: "Preparing documents",
  READY_TO_APPLY: "Ready to apply",
  SUBMITTED: "Submitted",
  INTERVIEW: "Interview",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  WAITLISTED: "Waitlisted",
};

export const DOCUMENT_CATEGORIES = [
  "PASSPORT",
  "ACADEMIC_TRANSCRIPT",
  "IELTS_CERTIFICATE",
  "SAT_SCORE_REPORT",
  "RECOMMENDATION_LETTER",
  "PERSONAL_STATEMENT",
  "CV",
  "OTHER",
] as const satisfies readonly StudentDocumentCategory[];

export const DOCUMENT_CATEGORY_LABELS: Record<StudentDocumentCategory, string> =
  {
    PASSPORT: "Passport",
    ACADEMIC_TRANSCRIPT: "Academic transcript",
    IELTS_CERTIFICATE: "IELTS certificate",
    SAT_SCORE_REPORT: "SAT score report",
    RECOMMENDATION_LETTER: "Recommendation letter",
    PERSONAL_STATEMENT: "Personal statement",
    CV: "CV",
    OTHER: "Other",
  };

export const NOTIFICATION_LABELS: Record<StudentNotificationType, string> = {
  DEADLINE: "Upcoming deadlines",
  APPLICATION_STATUS: "Application updates",
  MISSING_DOCUMENT: "Missing documents",
  SCHOLARSHIP_ANNOUNCEMENT: "Scholarship announcements",
};

export const PRIVATE_DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;
export const PRIVATE_DOCUMENT_TYPES = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
} as const;
