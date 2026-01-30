-- Migration: Create user_encryption_key table for split-key encryption
-- Each user has a unique salt used to derive their DEK via HKDF(clientKey + masterKey, salt).
-- The DEK is never stored — it's derived on each request from the client key and master key.

CREATE TABLE IF NOT EXISTS public.user_encryption_key (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  salt TEXT NOT NULL,
  kdf_iterations INTEGER NOT NULL DEFAULT 600000
    CHECK (kdf_iterations >= 100000 AND kdf_iterations <= 5000000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: only service_role can access this table (backend manages keys)
ALTER TABLE public.user_encryption_key ENABLE ROW LEVEL SECURITY;

-- Defense-in-depth: RLS restricts to service_role even if GRANT/REVOKE is misconfigured.
-- No DELETE policy prevents RLS-based deletion.
CREATE POLICY "service_role_select" ON public.user_encryption_key
  FOR SELECT USING ((select auth.role()) = 'service_role');

CREATE POLICY "service_role_insert" ON public.user_encryption_key
  FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');

CREATE POLICY "service_role_update" ON public.user_encryption_key
  FOR UPDATE USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- Revoke direct access from authenticated users (keys managed by backend only)
REVOKE ALL ON public.user_encryption_key FROM authenticated;
REVOKE ALL ON public.user_encryption_key FROM anon;

-- Grant to service_role only
GRANT ALL ON public.user_encryption_key TO service_role;
