-- Backfill: mark delivered loads before today (UTC) as paid.
-- paidAt defaults to dateDelivered when not already set.
-- Run in pgAdmin against production after reviewing the preview below.
-- Idempotent: only updates rows where isPaid = false.

-- Preview: how many rows will be updated
SELECT COUNT(*) AS loads_to_backfill
FROM "Loads"
WHERE "dateDelivered" IS NOT NULL
  AND "dateDelivered" < CURRENT_DATE
  AND "isPaid" = false;

-- Preview: sample PRO numbers
SELECT "proNumber", "dateDelivered", "projectedNet", "isPaid", "paidAt"
FROM "Loads"
WHERE "dateDelivered" IS NOT NULL
  AND "dateDelivered" < CURRENT_DATE
  AND "isPaid" = false
ORDER BY "dateDelivered" DESC
LIMIT 25;

-- Apply backfill
UPDATE "Loads"
SET "isPaid" = true,
    "paidAt" = COALESCE("paidAt", "dateDelivered")
WHERE "dateDelivered" IS NOT NULL
  AND "dateDelivered" < CURRENT_DATE
  AND "isPaid" = false;

-- Unmark a single outstanding load (replace PRO)
-- UPDATE "Loads"
-- SET "isPaid" = false, "paidAt" = NULL
-- WHERE "proNumber" = 'YOUR_PRO_HERE';
