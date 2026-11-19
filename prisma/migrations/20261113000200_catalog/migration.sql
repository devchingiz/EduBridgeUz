-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('VERIFIED', 'NEEDS_REVIEW', 'UNVERIFIED', 'EXPIRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "FundingType" AS ENUM ('FULLY_FUNDED', 'PARTIAL', 'TUITION_WAIVER', 'STIPEND', 'OTHER');

-- CreateEnum
CREATE TYPE "EligibilityScope" AS ENUM ('ALL', 'LISTED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RequirementKind" AS ENUM ('ACADEMIC', 'ENGLISH_LANGUAGE', 'DOCUMENT', 'PORTFOLIO', 'WORK_EXPERIENCE', 'OTHER');

-- CreateEnum
CREATE TYPE "CatalogEntityType" AS ENUM ('UNIVERSITY', 'PROGRAM', 'SCHOLARSHIP');

-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('IMPORT', 'APPROVE', 'REQUEST_CHANGES', 'EXPIRE', 'RESTORE', 'FLAG_STALE');

-- CreateTable
CREATE TABLE "SourceCitation" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publisher" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "accessedAt" DATE NOT NULL,
    "verifiedAt" DATE,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceCitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "University" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "city" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "websiteUrl" TEXT NOT NULL,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "lastVerifiedAt" DATE,
    "nextReviewAt" DATE,
    "primarySourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "University_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "degreeLevel" "DegreeLevel" NOT NULL,
    "field" TEXT NOT NULL,
    "language" TEXT,
    "durationMonths" INTEGER,
    "credits" INTEGER,
    "startMonths" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "lastVerifiedAt" DATE,
    "nextReviewAt" DATE,
    "primarySourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scholarship" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "providerUrl" TEXT NOT NULL,
    "hostCountryCode" TEXT,
    "fundingType" "FundingType" NOT NULL,
    "degreeLevels" "DegreeLevel"[],
    "nationalityScope" "EligibilityScope" NOT NULL DEFAULT 'UNKNOWN',
    "eligibleNationalities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fieldScope" "EligibilityScope" NOT NULL DEFAULT 'UNKNOWN',
    "fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "summary" TEXT NOT NULL,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "lastVerifiedAt" DATE,
    "nextReviewAt" DATE,
    "primarySourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scholarship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Requirement" (
    "id" TEXT NOT NULL,
    "programId" TEXT,
    "scholarshipId" TEXT,
    "kind" "RequirementKind" NOT NULL,
    "summary" TEXT NOT NULL,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'VERIFIED',
    "sourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Requirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TuitionFact" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "note" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'VERIFIED',
    "sourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TuitionFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeadlineFact" (
    "id" TEXT NOT NULL,
    "programId" TEXT,
    "scholarshipId" TEXT,
    "cycle" TEXT NOT NULL,
    "applicantGroup" TEXT,
    "opensOn" DATE,
    "deadlineOn" DATE,
    "opensMonthDay" TEXT,
    "deadlineMonthDay" TEXT,
    "note" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'VERIFIED',
    "sourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeadlineFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogReview" (
    "id" TEXT NOT NULL,
    "entityType" "CatalogEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "decision" "ReviewDecision" NOT NULL,
    "fromStatus" "VerificationStatus",
    "toStatus" "VerificationStatus" NOT NULL,
    "note" TEXT,
    "reviewerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SourceCitation_url_key" ON "SourceCitation"("url");

-- CreateIndex
CREATE INDEX "SourceCitation_verifiedAt_idx" ON "SourceCitation"("verifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "University_slug_key" ON "University"("slug");

-- CreateIndex
CREATE INDEX "University_countryCode_verificationStatus_idx" ON "University"("countryCode", "verificationStatus");

-- CreateIndex
CREATE INDEX "University_verificationStatus_nextReviewAt_idx" ON "University"("verificationStatus", "nextReviewAt");

-- CreateIndex
CREATE INDEX "University_name_idx" ON "University"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Program_universityId_slug_key" ON "Program"("universityId", "slug");

-- CreateIndex
CREATE INDEX "Program_degreeLevel_field_idx" ON "Program"("degreeLevel", "field");

-- CreateIndex
CREATE INDEX "Program_verificationStatus_nextReviewAt_idx" ON "Program"("verificationStatus", "nextReviewAt");

-- CreateIndex
CREATE UNIQUE INDEX "Scholarship_slug_key" ON "Scholarship"("slug");

-- CreateIndex
CREATE INDEX "Scholarship_hostCountryCode_verificationStatus_idx" ON "Scholarship"("hostCountryCode", "verificationStatus");

-- CreateIndex
CREATE INDEX "Scholarship_fundingType_verificationStatus_idx" ON "Scholarship"("fundingType", "verificationStatus");

-- CreateIndex
CREATE INDEX "Scholarship_verificationStatus_nextReviewAt_idx" ON "Scholarship"("verificationStatus", "nextReviewAt");

-- CreateIndex
CREATE INDEX "Requirement_programId_idx" ON "Requirement"("programId");

-- CreateIndex
CREATE INDEX "Requirement_scholarshipId_idx" ON "Requirement"("scholarshipId");

-- CreateIndex
CREATE INDEX "TuitionFact_programId_idx" ON "TuitionFact"("programId");

-- CreateIndex
CREATE INDEX "DeadlineFact_programId_idx" ON "DeadlineFact"("programId");

-- CreateIndex
CREATE INDEX "DeadlineFact_scholarshipId_idx" ON "DeadlineFact"("scholarshipId");

-- CreateIndex
CREATE INDEX "DeadlineFact_deadlineOn_idx" ON "DeadlineFact"("deadlineOn");

-- CreateIndex
CREATE INDEX "CatalogReview_entityType_entityId_createdAt_idx" ON "CatalogReview"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "CatalogReview_reviewerId_createdAt_idx" ON "CatalogReview"("reviewerId", "createdAt");

-- CreateIndex
CREATE INDEX "CatalogReview_decision_createdAt_idx" ON "CatalogReview"("decision", "createdAt");

-- AddForeignKey
ALTER TABLE "SourceCitation" ADD CONSTRAINT "SourceCitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "University" ADD CONSTRAINT "University_primarySourceId_fkey" FOREIGN KEY ("primarySourceId") REFERENCES "SourceCitation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_primarySourceId_fkey" FOREIGN KEY ("primarySourceId") REFERENCES "SourceCitation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scholarship" ADD CONSTRAINT "Scholarship_primarySourceId_fkey" FOREIGN KEY ("primarySourceId") REFERENCES "SourceCitation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_scholarshipId_fkey" FOREIGN KEY ("scholarshipId") REFERENCES "Scholarship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "SourceCitation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TuitionFact" ADD CONSTRAINT "TuitionFact_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TuitionFact" ADD CONSTRAINT "TuitionFact_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "SourceCitation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeadlineFact" ADD CONSTRAINT "DeadlineFact_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeadlineFact" ADD CONSTRAINT "DeadlineFact_scholarshipId_fkey" FOREIGN KEY ("scholarshipId") REFERENCES "Scholarship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeadlineFact" ADD CONSTRAINT "DeadlineFact_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "SourceCitation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogReview" ADD CONSTRAINT "CatalogReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
