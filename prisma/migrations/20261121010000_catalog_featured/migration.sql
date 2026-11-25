-- Additive pinning flag for administrator-managed featured catalog records.
-- Existing rows remain unfeatured; no data is rewritten or removed.
ALTER TABLE "University" ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Scholarship" ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "University_featured_verificationStatus_idx" ON "University"("featured", "verificationStatus");
CREATE INDEX "Scholarship_featured_verificationStatus_idx" ON "Scholarship"("featured", "verificationStatus");
