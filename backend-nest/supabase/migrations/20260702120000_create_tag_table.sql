-- PUL-18: user-owned tags to classify expenses (replaces free-text transaction.category long-term).
-- Owner-only RLS, mirrors the savings_goal policy shape (4 policies, (SELECT auth.uid()) subselect).

CREATE TABLE IF NOT EXISTS "public"."tag" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    "user_id" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "name" text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 30),
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Case-insensitive uniqueness per user; backs the 409 ERR_TAG_ALREADY_EXISTS conflict.
-- normalize(NFC) folds Unicode composition forms (iOS clients emit NFD) so
-- visually identical names collide instead of coexisting.
CREATE UNIQUE INDEX "idx_tag_user_id_name_lower" ON "public"."tag" ("user_id", lower(normalize("name", NFC)));
CREATE INDEX "idx_tag_user_id" ON "public"."tag" ("user_id");

CREATE OR REPLACE TRIGGER "update_tag_updated_at"
  BEFORE UPDATE ON "public"."tag"
  FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

ALTER TABLE "public"."tag" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tags" ON "public"."tag"
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create own tags" ON "public"."tag"
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own tags" ON "public"."tag"
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own tags" ON "public"."tag"
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."tag" TO authenticated;
