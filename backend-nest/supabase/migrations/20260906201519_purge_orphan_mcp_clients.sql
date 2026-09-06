-- pulpe:migration-phase contract
-- pulpe:safe-after v0.48.0
-- Only new MCP objects are affected; production v0.48.0 has no MCP consumers.
CREATE INDEX mcp_oauth_client_created_at_idx ON public.mcp_oauth_client(created_at);
CREATE INDEX mcp_connection_client_id_idx ON public.mcp_connection(client_id);

-- Keep every previously associated client, including revoked grants for reconnection.
-- Unassociated registrations have thirty days to begin an authorization.
CREATE FUNCTION public.mcp_oauth_purge_orphan_clients()
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  candidate text;
BEGIN
  FOR candidate IN
    SELECT c.id FROM public.mcp_oauth_client c
    WHERE c.created_at < now() - interval '30 days'
      AND NOT EXISTS (SELECT 1 FROM public.mcp_oauth_authorization a WHERE a.client_id = c.id)
      AND NOT EXISTS (SELECT 1 FROM public.mcp_connection g WHERE g.client_id = c.id)
    FOR UPDATE OF c SKIP LOCKED
  LOOP
    -- A separate statement rechecks a fresh snapshot after locking the client.
    -- The FK's key-share lock prevents a concurrent authorization being cascaded away.
    DELETE FROM public.mcp_oauth_client c WHERE c.id = candidate
      AND NOT EXISTS (SELECT 1 FROM public.mcp_oauth_authorization a WHERE a.client_id = c.id)
      AND NOT EXISTS (SELECT 1 FROM public.mcp_connection g WHERE g.client_id = c.id);
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.mcp_oauth_purge_orphan_clients() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_oauth_purge_orphan_clients() TO service_role;
