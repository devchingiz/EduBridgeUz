-- Controlled CMS document for the marketing homepage.
-- No existing rows are rewritten or removed.
CREATE TABLE "HomepageContent" (
    "id" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HomepageContent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HomepageContent_updatedById_idx" ON "HomepageContent"("updatedById");

ALTER TABLE "HomepageContent" ADD CONSTRAINT "HomepageContent_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
