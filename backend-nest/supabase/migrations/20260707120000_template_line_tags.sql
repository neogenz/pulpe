-- PUL-18 — attach tags to template_line (modèles), same shape as
-- transaction_tag / budget_line_tag. Ownership flows from the parent template
-- via template.user_id; INSERT additionally requires owning the tag. Public
-- templates (user_id IS NULL) are not taggable — tags are personal metadata.
--
-- Tags propagate to budgets two ways, both handled here:
--   1. New budget generation: create_budget_from_template copies each
--      template_line's tags onto the budget_line it generates.
--   2. Editing an existing template (the "propagate to all budgets / current"
--      dialog): the repository calls bulk_replace_template_line_tags_and_sync
--      after apply_template_line_operations, atomically replacing every tag
--      set and mirroring it onto the chosen budgets.
--
-- The security-hardened apply_template_line_operations RPC (PUL-272) is left
-- untouched: tag replacement is composed from small atomic RPCs at the repo
-- layer instead of rewriting a SECURITY DEFINER function.

CREATE TABLE IF NOT EXISTS "public"."template_line_tag" (
    "template_line_id" uuid NOT NULL REFERENCES "public"."template_line"(id) ON DELETE CASCADE,
    "tag_id" uuid NOT NULL REFERENCES "public"."tag"(id) ON DELETE CASCADE,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY ("template_line_id", "tag_id")
);

CREATE INDEX "idx_template_line_tag_tag_id" ON "public"."template_line_tag" ("tag_id");

ALTER TABLE "public"."template_line_tag" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own template line tags" ON "public"."template_line_tag"
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM "public"."template_line" tl
      JOIN "public"."template" t ON t.id = tl.template_id
      WHERE tl.id = template_line_tag.template_line_id
        AND t.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can link own tags to own template lines" ON "public"."template_line_tag"
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM "public"."template_line" tl
      JOIN "public"."template" t ON t.id = tl.template_id
      WHERE tl.id = template_line_tag.template_line_id
        AND t.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM "public"."tag"
      WHERE tag.id = template_line_tag.tag_id
        AND tag.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can unlink own template line tags" ON "public"."template_line_tag"
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM "public"."template_line" tl
      JOIN "public"."template" t ON t.id = tl.template_id
      WHERE tl.id = template_line_tag.template_line_id
        AND t.user_id = (SELECT auth.uid())
    )
  );

GRANT SELECT, INSERT, DELETE ON "public"."template_line_tag" TO authenticated;

-- Atomic replace-set for a single template line's tags. SECURITY INVOKER (RLS
-- applies): a foreign template or foreign tag id surfaces as 42501 / 23503,
-- the same SQLSTATEs the API already maps to ERR_TAG_NOT_FOUND. delete+insert
-- in one plpgsql body rolls back the delete if the insert fails.
CREATE OR REPLACE FUNCTION public.replace_template_line_tags(
  p_template_line_id uuid,
  p_tag_ids uuid[]
) RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM template_line_tag
  WHERE template_line_id = p_template_line_id;

  INSERT INTO template_line_tag (template_line_id, tag_id)
  SELECT p_template_line_id, tag_id
  FROM unnest(p_tag_ids) AS tag_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.replace_template_line_tags(uuid, uuid[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_template_line_tags(uuid, uuid[])
  TO authenticated, service_role;

-- Replace N template-line tag sets and mirror them onto generated budget_lines
-- in one transaction. Only non-manually-adjusted lines are propagated — same
-- lock semantics as apply_template_line_operations. SECURITY INVOKER keeps RLS
-- active for both junction tables.
CREATE OR REPLACE FUNCTION public.bulk_replace_template_line_tags_and_sync(
  p_line_tag_pairs jsonb,
  p_budget_ids uuid[]
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  line_pair record;
  template_line_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  FOR line_pair IN
    SELECT *
    FROM jsonb_to_recordset(p_line_tag_pairs)
      AS x(template_line_id uuid, tag_ids uuid[])
  LOOP
    DELETE FROM template_line_tag
    WHERE template_line_id = line_pair.template_line_id;

    INSERT INTO template_line_tag (template_line_id, tag_id)
    SELECT line_pair.template_line_id, tag_id
    FROM unnest(line_pair.tag_ids) AS tag_id;

    template_line_ids := array_append(
      template_line_ids,
      line_pair.template_line_id
    );
  END LOOP;

  IF cardinality(template_line_ids) > 0 AND cardinality(p_budget_ids) > 0 THEN
    DELETE FROM budget_line_tag blt
    USING budget_line bl
    WHERE blt.budget_line_id = bl.id
      AND bl.template_line_id = ANY(template_line_ids)
      AND bl.budget_id = ANY(p_budget_ids)
      AND bl.is_manually_adjusted = false;

    INSERT INTO budget_line_tag (budget_line_id, tag_id)
    SELECT bl.id, tlt.tag_id
    FROM budget_line bl
    JOIN template_line_tag tlt ON tlt.template_line_id = bl.template_line_id
    WHERE bl.template_line_id = ANY(template_line_ids)
      AND bl.budget_id = ANY(p_budget_ids)
      AND bl.is_manually_adjusted = false
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bulk_replace_template_line_tags_and_sync(jsonb, uuid[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_replace_template_line_tags_and_sync(jsonb, uuid[])
  TO authenticated, service_role;

-- Regenerate create_budget_from_template so a freshly generated budget_line
-- inherits its source template_line's tags. Body is verbatim from
-- 20260508120000 except: the INSERT now captures the new budget_line id, and a
-- follow-up INSERT copies template_line_tag -> budget_line_tag for that line.
CREATE OR REPLACE FUNCTION public.create_budget_from_template(
  p_user_id uuid,
  p_template_id uuid,
  p_month integer,
  p_year integer,
  p_description text
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  new_budget_id uuid;
  new_budget_line_id uuid;
  template_record record;
  template_line_record record;
  budget_line_count integer := 0;
BEGIN
  SELECT id, user_id, name INTO template_record
  FROM public.template
  WHERE id = p_template_id
    AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found or access denied';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.monthly_budget
    WHERE user_id = p_user_id
      AND month = p_month
      AND year = p_year
  ) THEN
    RAISE EXCEPTION 'Budget already exists for this period';
  END IF;

  INSERT INTO public.monthly_budget (user_id, template_id, month, year, description)
  VALUES (p_user_id, p_template_id, p_month, p_year, p_description)
  RETURNING id INTO new_budget_id;

  FOR template_line_record IN
    SELECT tl.id, tl.amount, tl.kind, tl.recurrence, tl.name, tl.description,
           tl.original_amount, tl.original_currency, tl.target_currency, tl.exchange_rate
    FROM public.template_line tl
    WHERE tl.template_id = p_template_id
    ORDER BY tl.created_at
  LOOP
    INSERT INTO public.budget_line (
      budget_id, template_line_id, amount, kind, recurrence, name,
      original_amount, original_currency, target_currency, exchange_rate
    ) VALUES (
      new_budget_id,
      template_line_record.id,
      template_line_record.amount,
      template_line_record.kind,
      template_line_record.recurrence,
      template_line_record.name,
      template_line_record.original_amount,
      template_line_record.original_currency,
      template_line_record.target_currency,
      template_line_record.exchange_rate
    )
    RETURNING id INTO new_budget_line_id;

    INSERT INTO public.budget_line_tag (budget_line_id, tag_id)
    SELECT new_budget_line_id, tlt.tag_id
    FROM public.template_line_tag tlt
    WHERE tlt.template_line_id = template_line_record.id;

    budget_line_count := budget_line_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'budget', (
      SELECT to_jsonb(b.*)
      FROM public.monthly_budget b
      WHERE b.id = new_budget_id
    ),
    'budget_lines_created', budget_line_count,
    'template_name', template_record.name
  );
END;
$$;

ALTER FUNCTION public.create_budget_from_template(uuid, uuid, integer, integer, text) OWNER TO postgres;
