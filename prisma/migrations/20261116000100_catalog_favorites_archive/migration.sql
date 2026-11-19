-- Add an auditable archive decision for removing catalog records from public
-- discovery without destroying their source and review history.
ALTER TYPE "ReviewDecision" ADD VALUE 'ARCHIVE' BEFORE 'FLAG_STALE';

CREATE TABLE "UniversityFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UniversityFavorite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScholarshipFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scholarshipId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScholarshipFavorite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UniversityFavorite_userId_universityId_key"
    ON "UniversityFavorite"("userId", "universityId");
CREATE INDEX "UniversityFavorite_userId_createdAt_idx"
    ON "UniversityFavorite"("userId", "createdAt");
CREATE UNIQUE INDEX "ScholarshipFavorite_userId_scholarshipId_key"
    ON "ScholarshipFavorite"("userId", "scholarshipId");
CREATE INDEX "ScholarshipFavorite_userId_createdAt_idx"
    ON "ScholarshipFavorite"("userId", "createdAt");

ALTER TABLE "UniversityFavorite"
    ADD CONSTRAINT "UniversityFavorite_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UniversityFavorite"
    ADD CONSTRAINT "UniversityFavorite_universityId_fkey"
    FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScholarshipFavorite"
    ADD CONSTRAINT "ScholarshipFavorite_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScholarshipFavorite"
    ADD CONSTRAINT "ScholarshipFavorite_scholarshipId_fkey"
    FOREIGN KEY ("scholarshipId") REFERENCES "Scholarship"("id") ON DELETE CASCADE ON UPDATE CASCADE;
