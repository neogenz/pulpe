-- PUL-18: update each tagged entity and its replace-set junction in one
-- PostgreSQL transaction. Repositories encrypt financial fields before these
-- RPCs receive the JSON patch. SECURITY INVOKER keeps every table's RLS active.

CREATE OR REPLACE FUNCTION public.update_transaction_with_tags(
  p_transaction_id uuid,
  p_patch jsonb,
  p_tag_ids uuid[]
) RETURNS public.transaction
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  current_row public.transaction%ROWTYPE;
  patched_row public.transaction%ROWTYPE;
BEGIN
  SELECT source.*
  INTO current_row
  FROM public.transaction AS source
  WHERE source.id = p_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found' USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE(p_patch, '{}'::jsonb) <> '{}'::jsonb THEN
    SELECT populated.*
    INTO patched_row
    FROM jsonb_populate_record(current_row, p_patch) AS populated;

    UPDATE public.transaction AS target
    SET
      name = patched_row.name,
      amount = patched_row.amount,
      original_amount = patched_row.original_amount,
      original_currency = patched_row.original_currency,
      target_currency = patched_row.target_currency,
      exchange_rate = patched_row.exchange_rate,
      kind = patched_row.kind,
      transaction_date = patched_row.transaction_date,
      checked_at = patched_row.checked_at,
      updated_at = patched_row.updated_at
    WHERE target.id = p_transaction_id
    RETURNING target.* INTO current_row;
  END IF;

  DELETE FROM public.transaction_tag AS link
  WHERE link.transaction_id = p_transaction_id;

  INSERT INTO public.transaction_tag (transaction_id, tag_id)
  SELECT p_transaction_id, tag_id
  FROM unnest(COALESCE(p_tag_ids, ARRAY[]::uuid[])) AS tag_id;

  RETURN current_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_transaction_with_tags(uuid, jsonb, uuid[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_transaction_with_tags(uuid, jsonb, uuid[])
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.update_budget_line_with_tags(
  p_budget_line_id uuid,
  p_patch jsonb,
  p_tag_ids uuid[]
) RETURNS public.budget_line
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  current_row public.budget_line%ROWTYPE;
  patched_row public.budget_line%ROWTYPE;
BEGIN
  SELECT source.*
  INTO current_row
  FROM public.budget_line AS source
  WHERE source.id = p_budget_line_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Budget line not found' USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE(p_patch, '{}'::jsonb) <> '{}'::jsonb THEN
    SELECT populated.*
    INTO patched_row
    FROM jsonb_populate_record(current_row, p_patch) AS populated;

    UPDATE public.budget_line AS target
    SET
      template_line_id = patched_row.template_line_id,
      savings_goal_id = patched_row.savings_goal_id,
      name = patched_row.name,
      amount = patched_row.amount,
      original_amount = patched_row.original_amount,
      original_currency = patched_row.original_currency,
      target_currency = patched_row.target_currency,
      exchange_rate = patched_row.exchange_rate,
      kind = patched_row.kind,
      recurrence = patched_row.recurrence,
      is_manually_adjusted = patched_row.is_manually_adjusted,
      checked_at = patched_row.checked_at,
      updated_at = patched_row.updated_at
    WHERE target.id = p_budget_line_id
    RETURNING target.* INTO current_row;
  END IF;

  DELETE FROM public.budget_line_tag AS link
  WHERE link.budget_line_id = p_budget_line_id;

  INSERT INTO public.budget_line_tag (budget_line_id, tag_id)
  SELECT p_budget_line_id, tag_id
  FROM unnest(COALESCE(p_tag_ids, ARRAY[]::uuid[])) AS tag_id;

  RETURN current_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_budget_line_with_tags(uuid, jsonb, uuid[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_budget_line_with_tags(uuid, jsonb, uuid[])
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.update_template_line_with_tags(
  p_template_line_id uuid,
  p_patch jsonb,
  p_tag_ids uuid[]
) RETURNS public.template_line
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  current_row public.template_line%ROWTYPE;
  patched_row public.template_line%ROWTYPE;
BEGIN
  SELECT source.*
  INTO current_row
  FROM public.template_line AS source
  WHERE source.id = p_template_line_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template line not found' USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE(p_patch, '{}'::jsonb) <> '{}'::jsonb THEN
    SELECT populated.*
    INTO patched_row
    FROM jsonb_populate_record(current_row, p_patch) AS populated;

    UPDATE public.template_line AS target
    SET
      savings_goal_id = patched_row.savings_goal_id,
      name = patched_row.name,
      amount = patched_row.amount,
      original_amount = patched_row.original_amount,
      original_currency = patched_row.original_currency,
      target_currency = patched_row.target_currency,
      exchange_rate = patched_row.exchange_rate,
      kind = patched_row.kind,
      recurrence = patched_row.recurrence,
      description = patched_row.description,
      updated_at = patched_row.updated_at
    WHERE target.id = p_template_line_id
    RETURNING target.* INTO current_row;
  END IF;

  DELETE FROM public.template_line_tag AS link
  WHERE link.template_line_id = p_template_line_id;

  INSERT INTO public.template_line_tag (template_line_id, tag_id)
  SELECT p_template_line_id, tag_id
  FROM unnest(COALESCE(p_tag_ids, ARRAY[]::uuid[])) AS tag_id;

  RETURN current_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_template_line_with_tags(uuid, jsonb, uuid[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_template_line_with_tags(uuid, jsonb, uuid[])
  TO authenticated, service_role;
