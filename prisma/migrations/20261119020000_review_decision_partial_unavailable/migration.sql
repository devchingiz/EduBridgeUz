-- Allow reviewers to explicitly mark a record as partially verified or as
-- having no available information, matching the VerificationStatus enum.
ALTER TYPE "ReviewDecision" ADD VALUE IF NOT EXISTS 'MARK_PARTIAL' AFTER 'ARCHIVE';
ALTER TYPE "ReviewDecision" ADD VALUE IF NOT EXISTS 'MARK_UNAVAILABLE' AFTER 'MARK_PARTIAL';
