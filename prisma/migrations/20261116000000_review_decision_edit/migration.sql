-- AlterEnum
-- Records a field/source edit distinctly from an import or a decision so the
-- reviewer audit trail can show when a record was changed without re-approval.
ALTER TYPE "ReviewDecision" ADD VALUE 'EDIT' AFTER 'IMPORT';
