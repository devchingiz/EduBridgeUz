CREATE TYPE "ApplicationStatus" AS ENUM (
    'INTERESTED',
    'RESEARCHING',
    'PREPARING_DOCUMENTS',
    'READY_TO_APPLY',
    'SUBMITTED',
    'INTERVIEW',
    'ACCEPTED',
    'REJECTED',
    'WAITLISTED'
);

CREATE TYPE "StudentDocumentCategory" AS ENUM (
    'PASSPORT',
    'ACADEMIC_TRANSCRIPT',
    'IELTS_CERTIFICATE',
    'SAT_SCORE_REPORT',
    'RECOMMENDATION_LETTER',
    'PERSONAL_STATEMENT',
    'CV',
    'OTHER'
);

CREATE TYPE "StudentNotificationType" AS ENUM (
    'DEADLINE',
    'APPLICATION_STATUS',
    'MISSING_DOCUMENT',
    'SCHOLARSHIP_ANNOUNCEMENT'
);

CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'INTERESTED',
    "notes" TEXT NOT NULL DEFAULT '',
    "deadline" DATE,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Application_progress_check" CHECK ("progress" >= 0 AND "progress" <= 100)
);

CREATE TABLE "ApplicationStatusEvent" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fromStatus" "ApplicationStatus",
    "toStatus" "ApplicationStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationStatusEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudentDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "StudentDocumentCategory" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentDocument_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StudentDocument_sizeBytes_check" CHECK ("sizeBytes" > 0 AND "sizeBytes" <= 5242880)
);

CREATE TABLE "ApplicationDocument" (
    "applicationId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationDocument_pkey" PRIMARY KEY ("applicationId", "documentId")
);

CREATE TABLE "NotificationPreference" (
    "userId" TEXT NOT NULL,
    "deadlines" BOOLEAN NOT NULL DEFAULT true,
    "applicationStatus" BOOLEAN NOT NULL DEFAULT true,
    "missingDocuments" BOOLEAN NOT NULL DEFAULT true,
    "scholarshipAnnouncements" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "StudentNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "StudentNotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Application_userId_universityId_key" ON "Application"("userId", "universityId");
CREATE INDEX "Application_userId_status_updatedAt_idx" ON "Application"("userId", "status", "updatedAt");
CREATE INDEX "Application_userId_deadline_idx" ON "Application"("userId", "deadline");
CREATE INDEX "ApplicationStatusEvent_applicationId_createdAt_idx" ON "ApplicationStatusEvent"("applicationId", "createdAt");
CREATE UNIQUE INDEX "StudentDocument_storageKey_key" ON "StudentDocument"("storageKey");
CREATE INDEX "StudentDocument_userId_category_createdAt_idx" ON "StudentDocument"("userId", "category", "createdAt");
CREATE INDEX "ApplicationDocument_documentId_idx" ON "ApplicationDocument"("documentId");
CREATE INDEX "StudentNotification_userId_readAt_createdAt_idx" ON "StudentNotification"("userId", "readAt", "createdAt");
CREATE INDEX "StudentNotification_userId_type_createdAt_idx" ON "StudentNotification"("userId", "type", "createdAt");

ALTER TABLE "Application" ADD CONSTRAINT "Application_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Application" ADD CONSTRAINT "Application_universityId_fkey"
    FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApplicationStatusEvent" ADD CONSTRAINT "ApplicationStatusEvent_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentDocument" ADD CONSTRAINT "StudentDocument_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicationDocument" ADD CONSTRAINT "ApplicationDocument_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicationDocument" ADD CONSTRAINT "ApplicationDocument_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "StudentDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentNotification" ADD CONSTRAINT "StudentNotification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
