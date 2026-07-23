-- PUL-18 PR2: attach tags to transactions (M:N) and retire the free-text
-- transaction.category field. Existing category values are preserved by
-- converting them into real tags + links before the column drops.

CREATE TABLE IF NOT EXISTS "public"."transaction_tag" (
    "transaction_id" uuid NOT NULL REFERENCES "public"."transaction"(id) ON DELETE CASCADE,
    "tag_id" uuid NOT NULL REFERENCES "public"."tag"(id) ON DELETE CASCADE,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY ("transaction_id", "tag_id")
);

-- PK covers transaction_id-prefixed lookups; tag_id needs its own index
-- (tag deletion cascade + future filter-by-tag queries).
CREATE INDEX "idx_transaction_tag_tag_id" ON "public"."transaction_tag" ("tag_id");

ALTER TABLE "public"."transaction_tag" ENABLE ROW LEVEL SECURITY;

-- Ownership flows from the parent transaction (via monthly_budget.user_id,
-- same join as the transaction table's own policies).
CREATE POLICY "Users can view own transaction tags" ON "public"."transaction_tag"
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM "public"."transaction" t
      JOIN "public"."monthly_budget" mb ON mb.id = t.budget_id
      WHERE t.id = transaction_tag.transaction_id
        AND mb.user_id = (SELECT auth.uid())
    )
  );

-- INSERT additionally requires owning the tag itself — blocks linking
-- another user's tag id to your transaction.
CREATE POLICY "Users can link own tags to own transactions" ON "public"."transaction_tag"
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM "public"."transaction" t
      JOIN "public"."monthly_budget" mb ON mb.id = t.budget_id
      WHERE t.id = transaction_tag.transaction_id
        AND mb.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM "public"."tag"
      WHERE tag.id = transaction_tag.tag_id
        AND tag.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can unlink own transaction tags" ON "public"."transaction_tag"
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM "public"."transaction" t
      JOIN "public"."monthly_budget" mb ON mb.id = t.budget_id
      WHERE t.id = transaction_tag.transaction_id
        AND mb.user_id = (SELECT auth.uid())
    )
  );

GRANT SELECT, INSERT, DELETE ON "public"."transaction_tag" TO authenticated;

-- Preserve legacy free-text categories as tags (truncated to the 30-char tag
-- limit; NFC+lower unique index dedupes case/composition variants).
INSERT INTO "public"."tag" (user_id, name)
SELECT DISTINCT mb.user_id, left(trim(t.category), 30)
FROM "public"."transaction" t
JOIN "public"."monthly_budget" mb ON mb.id = t.budget_id
WHERE t.category IS NOT NULL AND trim(t.category) <> ''
ON CONFLICT (user_id, lower(normalize(name, NFC))) DO NOTHING;

INSERT INTO "public"."transaction_tag" (transaction_id, tag_id)
SELECT t.id, tag.id
FROM "public"."transaction" t
JOIN "public"."monthly_budget" mb ON mb.id = t.budget_id
JOIN "public"."tag" ON tag.user_id = mb.user_id
  AND lower(normalize(tag.name, NFC)) = lower(normalize(left(trim(t.category), 30), NFC))
WHERE t.category IS NOT NULL AND trim(t.category) <> ''
ON CONFLICT DO NOTHING;

-- toggle_transaction_check / check_unchecked_transactions RPCs return the
-- table rowtype (SELECT * / RETURNING *) so they adapt to the drop; the
-- trigram search index idx_transaction_category_trgm drops with the column.
ALTER TABLE "public"."transaction" DROP COLUMN "category";
