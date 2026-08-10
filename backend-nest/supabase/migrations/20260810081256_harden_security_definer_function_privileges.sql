-- Remove the obsolete RPC and make every remaining SECURITY DEFINER endpoint
-- opt-in for authenticated callers.

DROP FUNCTION IF EXISTS public.bulk_update_template_lines(uuid, jsonb);

REVOKE EXECUTE ON FUNCTION public.check_unchecked_transactions(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_unchecked_transactions(uuid)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.toggle_budget_line_check(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_budget_line_check(uuid)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.toggle_transaction_check(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_transaction_check(uuid)
  TO authenticated, service_role;

-- PostgreSQL's implicit PUBLIC grant is global, so it must be revoked outside
-- the schema-specific ACL. Future RPCs then opt their API roles in explicitly.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
