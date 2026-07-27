-- A budget-line link must conflict with both the reconciliation RPC's
-- FOR UPDATE lock and an ordinary non-key target-date UPDATE. FOR KEY SHARE
-- did not conflict with the latter, leaving a race when the preview was empty.

CREATE OR REPLACE FUNCTION public.enforce_savings_goal_line_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_owner_id uuid;
  v_budget_month int;
  v_budget_year int;
  v_target_date date;
  v_pay_day int;
  v_target_period_start date;
  v_target_period_index int;
  v_budget_period_index int;
  v_link_changed boolean := false;
BEGIN
  IF NEW.kind <> 'saving'::public.transaction_kind THEN
    NEW.savings_goal_id := NULL;
    RETURN NEW;
  END IF;

  IF NEW.savings_goal_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'budget_line' THEN
    SELECT mb.user_id, mb.month, mb.year
    INTO v_owner_id, v_budget_month, v_budget_year
    FROM public.monthly_budget mb
    WHERE mb.id = NEW.budget_id;

    IF TG_OP = 'INSERT' THEN
      v_link_changed := true;
    ELSE
      v_link_changed :=
        OLD.savings_goal_id IS DISTINCT FROM NEW.savings_goal_id
        OR OLD.kind IS DISTINCT FROM NEW.kind
        OR OLD.budget_id IS DISTINCT FROM NEW.budget_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'template_line' THEN
    SELECT t.user_id
    INTO v_owner_id
    FROM public.template t
    WHERE t.id = NEW.template_id;
  ELSE
    RAISE EXCEPTION 'Unsupported savings goal link table: %', TG_TABLE_NAME
      USING ERRCODE = 'P0001';
  END IF;

  IF TG_TABLE_NAME = 'budget_line' AND v_link_changed THEN
    SELECT sg.target_date
    INTO v_target_date
    FROM public.savings_goal sg
    WHERE sg.id = NEW.savings_goal_id
      AND sg.user_id = v_owner_id
    FOR SHARE;
  ELSE
    SELECT sg.target_date
    INTO v_target_date
    FROM public.savings_goal sg
    WHERE sg.id = NEW.savings_goal_id
      AND sg.user_id = v_owner_id
    FOR KEY SHARE;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Savings goal access denied'
      USING ERRCODE = 'P0001';
  END IF;

  IF TG_TABLE_NAME = 'budget_line'
    AND v_link_changed
    AND v_target_date IS NOT NULL
  THEN
    SELECT CASE
      WHEN raw_user_meta_data->>'payDayOfMonth' ~ '^[0-9]+$'
      THEN GREATEST(
        1,
        LEAST(31, (raw_user_meta_data->>'payDayOfMonth')::int)
      )
      ELSE NULL
    END
    INTO v_pay_day
    FROM auth.users
    WHERE id = v_owner_id;

    v_target_period_start := date_trunc('month', v_target_date)::date;
    IF v_pay_day IS NOT NULL AND v_pay_day <> 1 THEN
      IF EXTRACT(DAY FROM v_target_date) < v_pay_day THEN
        v_target_period_start :=
          (v_target_period_start - INTERVAL '1 month')::date;
      END IF;
      IF v_pay_day > 15 THEN
        v_target_period_start :=
          (v_target_period_start + INTERVAL '1 month')::date;
      END IF;
    END IF;

    v_target_period_index :=
      EXTRACT(YEAR FROM v_target_period_start)::int * 12
      + EXTRACT(MONTH FROM v_target_period_start)::int;
    v_budget_period_index := v_budget_year * 12 + v_budget_month;

    IF v_budget_period_index > v_target_period_index THEN
      RAISE EXCEPTION 'Savings goal line outside target horizon'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_savings_goal_line_link() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.enforce_savings_goal_line_link()
  FROM PUBLIC, anon, authenticated;
