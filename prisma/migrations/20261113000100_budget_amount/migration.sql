-- Rename the budget column to reflect whole currency units rather than minor
-- units. Planning budgets are approximate and may use currencies without a
-- minor unit (for example UZS), so integer major units are the honest shape.

ALTER TABLE "StudentProfile"
  RENAME COLUMN "budgetAmountMinor" TO "budgetAmount";
