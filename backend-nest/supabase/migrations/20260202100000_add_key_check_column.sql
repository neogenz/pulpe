-- Migration: Add key_check column for vault code verification
-- Stores AES-256-GCM(DEK, "pulpe-key-check") — a canary ciphertext used to
-- verify that a given clientKey produces the correct DEK before granting access.

ALTER TABLE public.user_encryption_key
  ADD COLUMN IF NOT EXISTS key_check TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
