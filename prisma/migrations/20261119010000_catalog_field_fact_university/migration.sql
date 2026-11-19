-- Align CatalogFieldFact with the typed University.fieldFacts back-relation.
-- University facts carry this id; program and scholarship facts remain linked
-- by the generic entityType/entityId pair.

ALTER TABLE "CatalogFieldFact" ADD COLUMN     "universityId" TEXT;

CREATE INDEX "CatalogFieldFact_universityId_idx" ON "CatalogFieldFact"("universityId");

ALTER TABLE "CatalogFieldFact" ADD CONSTRAINT "CatalogFieldFact_universityId_fkey"
  FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE SET NULL ON UPDATE CASCADE;
