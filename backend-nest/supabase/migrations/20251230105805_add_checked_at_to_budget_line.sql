-- Add checked_at column to budget_line table
-- This allows users to mark budget lines as completed/realized

ALTER TABLE public.budget_line
ADD COLUMN checked_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.budget_line.checked_at IS
'Timestamp when the budget line was marked as completed by the user. NULL means not yet completed.';
