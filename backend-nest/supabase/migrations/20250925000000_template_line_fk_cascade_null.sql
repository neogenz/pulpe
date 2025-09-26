-- Allow deleting template lines without violating FK constraints
-- When a template line is deleted, the reference in budget_line is set to NULL
-- This preserves the budget line data while removing the template association

-- Drop existing foreign key constraint if it exists
ALTER TABLE public.budget_line
DROP CONSTRAINT IF EXISTS budget_line_template_line_id_fkey;

-- Recreate the foreign key with ON DELETE SET NULL behavior
ALTER TABLE public.budget_line
ADD CONSTRAINT budget_line_template_line_id_fkey
FOREIGN KEY (template_line_id)
REFERENCES public.template_line(id)
ON DELETE SET NULL;