-- Add wrapped_dek column for recovery key support.
-- Stores the DEK encrypted with the user's recovery key (AES-256-GCM).
-- The recovery key itself is never stored server-side.
ALTER TABLE public.user_encryption_key
  ADD COLUMN wrapped_dek TEXT;
