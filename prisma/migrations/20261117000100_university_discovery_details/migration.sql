CREATE TYPE "CostKind" AS ENUM ('LIVING_COST', 'APPLICATION_FEE');

CREATE TYPE "IntakeTerm" AS ENUM ('SPRING', 'SUMMER', 'AUTUMN', 'WINTER');

CREATE TABLE "ProgramCost" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "kind" "CostKind" NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "applicantGroup" TEXT,
    "note" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'VERIFIED',
    "sourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramCost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProgramIntake" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "term" "IntakeTerm" NOT NULL,
    "note" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'VERIFIED',
    "sourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramIntake_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProgramScholarship" (
    "programId" TEXT NOT NULL,
    "scholarshipId" TEXT NOT NULL,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'VERIFIED',
    "sourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgramScholarship_pkey" PRIMARY KEY ("programId", "scholarshipId")
);

CREATE INDEX "ProgramCost_programId_kind_idx" ON "ProgramCost"("programId", "kind");
CREATE INDEX "ProgramIntake_programId_term_idx" ON "ProgramIntake"("programId", "term");
CREATE UNIQUE INDEX "ProgramIntake_programId_term_sourceId_key" ON "ProgramIntake"("programId", "term", "sourceId");
CREATE INDEX "ProgramScholarship_scholarshipId_idx" ON "ProgramScholarship"("scholarshipId");

ALTER TABLE "ProgramCost" ADD CONSTRAINT "ProgramCost_programId_fkey"
FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgramCost" ADD CONSTRAINT "ProgramCost_sourceId_fkey"
FOREIGN KEY ("sourceId") REFERENCES "SourceCitation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProgramIntake" ADD CONSTRAINT "ProgramIntake_programId_fkey"
FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgramIntake" ADD CONSTRAINT "ProgramIntake_sourceId_fkey"
FOREIGN KEY ("sourceId") REFERENCES "SourceCitation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProgramScholarship" ADD CONSTRAINT "ProgramScholarship_programId_fkey"
FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgramScholarship" ADD CONSTRAINT "ProgramScholarship_scholarshipId_fkey"
FOREIGN KEY ("scholarshipId") REFERENCES "Scholarship"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgramScholarship" ADD CONSTRAINT "ProgramScholarship_sourceId_fkey"
FOREIGN KEY ("sourceId") REFERENCES "SourceCitation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
