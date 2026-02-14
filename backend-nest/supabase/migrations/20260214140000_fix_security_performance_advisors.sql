-- Fix Supabase Security & Performance Advisor warnings:
-- 1. Move pg_trgm extension from public to extensions schema
-- 2. Consolidate RLS policies on user_encryption_key (multiple permissive → single per operation)
-- 3. Wrap auth.uid() in (select ...) to avoid per-row re-evaluation

-- ═══════════════════════════════════════════════════════
-- 1. Move pg_trgm to extensions schema
-- ═══════════════════════════════════════════════════════
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- ═══════════════════════════════════════════════════════
-- 2. Drop all existing policies on user_encryption_key
-- ═══════════════════════════════════════════════════════
DROP POLICY IF EXISTS "service_role_select" ON public.user_encryption_key;
DROP POLICY IF EXISTS "service_role_insert" ON public.user_encryption_key;
DROP POLICY IF EXISTS "service_role_update" ON public.user_encryption_key;
DROP POLICY IF EXISTS "authenticated_select_own_key" ON public.user_encryption_key;
DROP POLICY IF EXISTS "authenticated_update_own_key_check" ON public.user_encryption_key;

-- ═══════════════════════════════════════════════════════
-- 3. Recreate as single policy per operation with (select ...) wrappers
-- ═══════════════════════════════════════════════════════

-- SELECT: service_role can read all, authenticated can read own row
CREATE POLICY "select_policy" ON public.user_encryption_key
  FOR SELECT
  USING (
    (select auth.role()) = 'service_role'
    OR user_id = (select auth.uid())
  );

-- INSERT: service_role only (backend manages key creation)
CREATE POLICY "insert_policy" ON public.user_encryption_key
  FOR INSERT
  WITH CHECK ((select auth.role()) = 'service_role');

-- UPDATE: service_role can update all, authenticated can update own row
CREATE POLICY "update_policy" ON public.user_encryption_key
  FOR UPDATE
  USING (
    (select auth.role()) = 'service_role'
    OR user_id = (select auth.uid())
  )
  WITH CHECK (
    (select auth.role()) = 'service_role'
    OR user_id = (select auth.uid())
  );
