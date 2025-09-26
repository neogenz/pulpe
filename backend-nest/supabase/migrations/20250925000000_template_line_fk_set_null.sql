-- Allow deleting template lines without violating FK constraints
-- Adjust budget_line.template_line_id foreign key to SET NULL
-- Ensure manual flag is set when a template link disappears

-- Step 1: Drop existing foreign key and recreate with ON DELETE SET NULL
ALTER TABLE public.budget_line
DROP CONSTRAINT IF EXISTS budget_line_template_line_id_fkey;

ALTER TABLE public.budget_line
ADD CONSTRAINT budget_line_template_line_id_fkey
FOREIGN KEY (template_line_id)
REFERENCES public.template_line(id)
ON DELETE SET NULL;

-- Step 2: Create helper function to mark budget lines as manually adjusted when link is removed
CREATE OR REPLACE FUNCTION public.mark_budget_line_manual_on_template_detach()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.template_line_id IS NOT NULL AND NEW.template_line_id IS NULL THEN
    NEW.is_manually_adjusted := true;
  END IF;
  RETURN NEW;
END;
$$;

-- Step 3: Attach trigger executing before each update (including FK-driven updates)
DROP TRIGGER IF EXISTS mark_budget_line_manual_on_template_detach ON public.budget_line;

CREATE TRIGGER mark_budget_line_manual_on_template_detach
BEFORE UPDATE ON public.budget_line
FOR EACH ROW
EXECUTE FUNCTION public.mark_budget_line_manual_on_template_detach();
