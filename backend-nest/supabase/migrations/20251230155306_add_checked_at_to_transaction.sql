-- Add checked_at column to transaction table
-- This allows users to mark transactions as "checked" (completed/verified)

ALTER TABLE public.transaction
ADD COLUMN checked_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.transaction.checked_at IS 'Timestamp when the transaction was marked as checked/verified. NULL means not checked.';
