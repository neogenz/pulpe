-- pulpe:migration-phase contract
-- pulpe:safe-after v0.47.1
-- Only MCP objects introduced with this feature are affected.
-- Revocation destroys the wrapped vault key: the column must accept NULL.
ALTER TABLE public.mcp_connection ALTER COLUMN wrapped_client_key DROP NOT NULL;

-- One row per write tool call made by an agent: which tool, when, and whether
-- it went through. Never an amount nor a user-typed label: the log describes
-- the gesture, not the content. Purged after twelve months (privacy policy).
CREATE TABLE public.mcp_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.mcp_connection(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('ok', 'error')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mcp_activity_connection_created_idx
  ON public.mcp_activity (connection_id, created_at DESC);
CREATE INDEX mcp_activity_created_at_idx ON public.mcp_activity (created_at);

ALTER TABLE public.mcp_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.mcp_activity
  FOR ALL USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

REVOKE ALL ON public.mcp_activity FROM authenticated;
REVOKE ALL ON public.mcp_activity FROM anon;
GRANT ALL ON public.mcp_activity TO service_role;
