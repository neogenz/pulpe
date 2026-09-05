-- pulpe:migration-phase contract
-- pulpe:safe-after v0.47.1
-- Only new MCP objects are affected; legacy clients do not depend on their grants.
-- One row per (user, OAuth client): the grant an AI agent holds on a Pulpe vault.
-- The JWT authenticates, this row authorizes: revocation is immediate (revoked_at),
-- the access mode lives here (never in a claim), and wrapped_client_key is the
-- user's vault key wrapped with MCP_WRAPPING_KEY so the agent can act without the PIN.
-- Backend-only table (service_role), like user_encryption_key.

CREATE TABLE public.mcp_connection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  client_name text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('read', 'read_write')),
  wrapped_client_key text NOT NULL,
  authorized_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (user_id, client_id)
);

CREATE INDEX mcp_connection_user_id_idx ON public.mcp_connection (user_id);

ALTER TABLE public.mcp_connection ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.mcp_connection
  FOR ALL USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

REVOKE ALL ON public.mcp_connection FROM authenticated;
REVOKE ALL ON public.mcp_connection FROM anon;
GRANT ALL ON public.mcp_connection TO service_role;
