-- PUL-12 — Savings goals foundation: model-level link + FK hardening + dormant priority + FX coherence.
--
-- 1. template_line.savings_goal_id: the link must live on the model (not only on
--    budget_line) so a recurring saving line stays tagged across monthly
--    regenerations. FK ON DELETE SET NULL — deleting a goal unlinks lines, never
--    deletes them.
-- 2. budget_line.savings_goal_id FK currently has NO ON DELETE. You cannot ALTER
--    an ON DELETE clause — DROP then recreate it with ON DELETE SET NULL.
-- 3. priority is removed from the product. The column is NOT NULL today; the API
--    stops sending it, so make it nullable (dormant). No destructive drop now.
-- 4. fx_metadata_coherent on savings_goal (FX door-keeper, dormant in v1). The
--    encrypted source field is original_target_amount (≠ generic original_amount).

BEGIN;

-- 1. template_line link ---------------------------------------------------------
ALTER TABLE "public"."template_line"
  ADD COLUMN "savings_goal_id" "uuid";

ALTER TABLE "public"."template_line"
  ADD CONSTRAINT "template_line_savings_goal_id_fkey"
  FOREIGN KEY ("savings_goal_id")
  REFERENCES "public"."savings_goal"("id")
  ON DELETE SET NULL;

CREATE INDEX "idx_template_line_savings_goal_id"
  ON "public"."template_line" USING "btree" ("savings_goal_id");

-- 2. harden budget_line FK to ON DELETE SET NULL --------------------------------
ALTER TABLE "public"."budget_line"
  DROP CONSTRAINT "budget_line_savings_goal_id_fkey";

ALTER TABLE "public"."budget_line"
  ADD CONSTRAINT "budget_line_savings_goal_id_fkey"
  FOREIGN KEY ("savings_goal_id")
  REFERENCES "public"."savings_goal"("id")
  ON DELETE SET NULL;

-- 3. priority dormant (nullable) ------------------------------------------------
ALTER TABLE "public"."savings_goal"
  ALTER COLUMN "priority" DROP NOT NULL;

-- 4. FX coherence on savings_goal (mirror of fx_metadata_coherent, but the
--    encrypted source column is original_target_amount). All-or-nothing AND
--    consistent with target_currency. Backfill orphans first (no-op in v1 since
--    FX is dormant), then NOT VALID + VALIDATE atomically.
UPDATE "public"."savings_goal"
SET original_target_amount = NULL, original_currency = NULL, exchange_rate = NULL
WHERE NOT (
  (target_currency IS NULL AND original_target_amount IS NULL
     AND original_currency IS NULL AND exchange_rate IS NULL)
  OR (target_currency IS NOT NULL AND original_currency IS NULL
      AND original_target_amount IS NULL AND exchange_rate IS NULL)
  OR (target_currency IS NOT NULL AND original_currency IS NOT NULL
      AND original_target_amount IS NOT NULL AND exchange_rate IS NOT NULL
      AND original_currency <> target_currency)
);

ALTER TABLE "public"."savings_goal" ADD CONSTRAINT "fx_metadata_coherent"
CHECK (
  (target_currency IS NULL AND original_target_amount IS NULL
     AND original_currency IS NULL AND exchange_rate IS NULL)
  OR (target_currency IS NOT NULL AND original_currency IS NULL
      AND original_target_amount IS NULL AND exchange_rate IS NULL)
  OR (target_currency IS NOT NULL AND original_currency IS NOT NULL
      AND original_target_amount IS NOT NULL AND exchange_rate IS NOT NULL
      AND original_currency <> target_currency)
) NOT VALID;

ALTER TABLE "public"."savings_goal" VALIDATE CONSTRAINT "fx_metadata_coherent";

COMMIT;
