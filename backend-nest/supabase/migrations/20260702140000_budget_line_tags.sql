-- PUL-18 PR3: attach tags to budget_lines (prévisions), same shape as
-- transaction_tag. Ownership flows from the parent budget_line via
-- monthly_budget.user_id; INSERT additionally requires owning the tag.

CREATE TABLE IF NOT EXISTS "public"."budget_line_tag" (
    "budget_line_id" uuid NOT NULL REFERENCES "public"."budget_line"(id) ON DELETE CASCADE,
    "tag_id" uuid NOT NULL REFERENCES "public"."tag"(id) ON DELETE CASCADE,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY ("budget_line_id", "tag_id")
);

CREATE INDEX "idx_budget_line_tag_tag_id" ON "public"."budget_line_tag" ("tag_id");

ALTER TABLE "public"."budget_line_tag" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own budget line tags" ON "public"."budget_line_tag"
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM "public"."budget_line" bl
      JOIN "public"."monthly_budget" mb ON mb.id = bl.budget_id
      WHERE bl.id = budget_line_tag.budget_line_id
        AND mb.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can link own tags to own budget lines" ON "public"."budget_line_tag"
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM "public"."budget_line" bl
      JOIN "public"."monthly_budget" mb ON mb.id = bl.budget_id
      WHERE bl.id = budget_line_tag.budget_line_id
        AND mb.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM "public"."tag"
      WHERE tag.id = budget_line_tag.tag_id
        AND tag.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can unlink own budget line tags" ON "public"."budget_line_tag"
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM "public"."budget_line" bl
      JOIN "public"."monthly_budget" mb ON mb.id = bl.budget_id
      WHERE bl.id = budget_line_tag.budget_line_id
        AND mb.user_id = (SELECT auth.uid())
    )
  );

GRANT SELECT, INSERT, DELETE ON "public"."budget_line_tag" TO authenticated;
