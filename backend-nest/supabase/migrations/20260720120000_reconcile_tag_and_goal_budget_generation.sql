-- PUL-18 + PUL-285 — preserve template-line tags while skipping lines linked
-- to inactive savings goals when materializing a budget.

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
           tl.savings_goal_id,
           tl.original_amount, tl.original_currency, tl.target_currency, tl.exchange_rate
    FROM public.template_line tl
    LEFT JOIN public.savings_goal sg ON sg.id = tl.savings_goal_id
    WHERE tl.template_id = p_template_id
      AND (tl.savings_goal_id IS NULL OR sg.status = 'ACTIVE')
    ORDER BY tl.created_at
  LOOP
    INSERT INTO public.budget_line (
      budget_id, template_line_id, amount, kind, recurrence, name, savings_goal_id,
      original_amount, original_currency, target_currency, exchange_rate
    ) VALUES (
      new_budget_id,
      template_line_record.id,
      template_line_record.amount,
      template_line_record.kind,
      template_line_record.recurrence,
      template_line_record.name,
      template_line_record.savings_goal_id,
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

ALTER FUNCTION public.create_budget_from_template(uuid, uuid, integer, integer, text)
  OWNER TO postgres;
