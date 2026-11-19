-- Source-backed global university catalog extensions.

-- User-facing record statuses for third-party-sourced and unavailable records.
ALTER TYPE "VerificationStatus" ADD VALUE 'PARTIALLY_VERIFIED' BEFORE 'NEEDS_REVIEW';
ALTER TYPE "VerificationStatus" ADD VALUE 'INFORMATION_UNAVAILABLE' BEFORE 'NEEDS_REVIEW';

-- CreateEnum
CREATE TYPE "FieldVerificationStatus" AS ENUM ('VERIFIED', 'PARTIALLY_VERIFIED', 'NOT_VERIFIED', 'INFORMATION_UNAVAILABLE');

-- AlterTable: University
ALTER TABLE "University" ALTER COLUMN "websiteUrl" DROP NOT NULL;
ALTER TABLE "University" ADD COLUMN     "continent" TEXT;
ALTER TABLE "University" ADD COLUMN     "institutionType" TEXT;
ALTER TABLE "University" ADD COLUMN     "logoUrl" TEXT;
ALTER TABLE "University" ADD COLUMN     "description" TEXT;
ALTER TABLE "University" ADD COLUMN     "rankingOrganization" TEXT;
ALTER TABLE "University" ADD COLUMN     "rankingEdition" TEXT;
ALTER TABLE "University" ADD COLUMN     "rankingPosition" INTEGER;
ALTER TABLE "University" ADD COLUMN     "rankingDisplay" TEXT;
ALTER TABLE "University" ADD COLUMN     "rankingTied" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "University" ADD COLUMN     "rankingIsRange" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "University" ADD COLUMN     "qsNid" INTEGER;
ALTER TABLE "University" ADD COLUMN     "rankingSourceId" TEXT;

-- CreateTable
CREATE TABLE "CatalogFieldFact" (
    "id" TEXT NOT NULL,
    "entityType" "CatalogEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT,
    "status" "FieldVerificationStatus" NOT NULL,
    "sourceId" TEXT,
    "sourceUrl" TEXT,
    "sourceTitle" TEXT,
    "verifiedAt" DATE,
    "academicYear" TEXT,
    "intake" TEXT,
    "currency" TEXT,
    "unit" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogFieldFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UniversityComparison" (
    "userId" TEXT NOT NULL,
    "universityIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UniversityComparison_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "StudyNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "universityId" TEXT,
    "programId" TEXT,
    "scholarshipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "University_qsNid_key" ON "University"("qsNid");
CREATE INDEX "University_countryCode_rankingPosition_idx" ON "University"("countryCode", "rankingPosition");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogFieldFact_entityType_entityId_fieldKey_key" ON "CatalogFieldFact"("entityType", "entityId", "fieldKey");
CREATE INDEX "CatalogFieldFact_entityType_status_idx" ON "CatalogFieldFact"("entityType", "status");
CREATE INDEX "CatalogFieldFact_entityId_idx" ON "CatalogFieldFact"("entityId");

-- CreateIndex
CREATE INDEX "StudyNote_userId_updatedAt_idx" ON "StudyNote"("userId", "updatedAt");
CREATE INDEX "StudyNote_universityId_idx" ON "StudyNote"("universityId");

-- AddForeignKey
ALTER TABLE "University" ADD CONSTRAINT "University_rankingSourceId_fkey" FOREIGN KEY ("rankingSourceId") REFERENCES "SourceCitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogFieldFact" ADD CONSTRAINT "CatalogFieldFact_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "SourceCitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UniversityComparison" ADD CONSTRAINT "UniversityComparison_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyNote" ADD CONSTRAINT "StudyNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudyNote" ADD CONSTRAINT "StudyNote_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudyNote" ADD CONSTRAINT "StudyNote_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudyNote" ADD CONSTRAINT "StudyNote_scholarshipId_fkey" FOREIGN KEY ("scholarshipId") REFERENCES "Scholarship"("id") ON DELETE SET NULL ON UPDATE CASCADE;
