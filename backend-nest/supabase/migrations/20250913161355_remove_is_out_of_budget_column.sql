-- Remove unused is_out_of_budget column from transaction table
ALTER TABLE public.transaction
DROP COLUMN IF EXISTS is_out_of_budget;