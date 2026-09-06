-- Synthetic rows only; even the purge is rolled back.
BEGIN;
DO $$
DECLARE
  owner uuid := gen_random_uuid();
  prefix text := 'pulpe_retention_' || gen_random_uuid() || '_';
  label text;
BEGIN
  IF has_function_privilege('anon', 'public.mcp_oauth_purge_orphan_clients()', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.mcp_oauth_purge_orphan_clients()', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.mcp_oauth_purge_orphan_clients()', 'EXECUTE')
  THEN RAISE EXCEPTION 'FAIL: purge must be backend-only'; END IF;

  INSERT INTO auth.users (id, email, encrypted_password, instance_id, aud, role)
    VALUES (owner, owner || '@local.test', 'fake', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
  FOREACH label IN ARRAY ARRAY['old', 'recent', 'pending', 'active', 'revoked'] LOOP
    INSERT INTO public.mcp_oauth_client(id, encrypted_metadata, created_at)
      VALUES (prefix || label, 'synthetic', CASE WHEN label = 'recent' THEN now() ELSE now() - interval '31 days' END);
  END LOOP;
  INSERT INTO public.mcp_oauth_authorization(client_id, redirect_uri, resource, challenge)
    VALUES (prefix || 'pending', 'https://client.test/cb', 'https://api.test/mcp', repeat('A', 43));
  INSERT INTO public.mcp_connection(user_id, client_id, client_name, mode, wrapped_client_key, encrypted_upstream, grant_expires_at)
    VALUES (owner, prefix || 'active', 'Test', 'read', 'synthetic', 'synthetic', now() + interval '1 day');
  INSERT INTO public.mcp_connection(user_id, client_id, client_name, mode, wrapped_client_key, revoked_at)
    VALUES (owner, prefix || 'revoked', 'Test', 'read', NULL, now());

  PERFORM public.mcp_oauth_purge_orphan_clients();
  IF EXISTS (SELECT 1 FROM public.mcp_oauth_client WHERE id = prefix || 'old') THEN
    RAISE EXCEPTION 'FAIL: orphan registration retained beyond thirty days';
  END IF;
  FOREACH label IN ARRAY ARRAY['recent', 'pending', 'active', 'revoked'] LOOP
    IF NOT EXISTS (SELECT 1 FROM public.mcp_oauth_client WHERE id = prefix || label) THEN
      RAISE EXCEPTION 'FAIL: deleted % client', label;
    END IF;
  END LOOP;
  DELETE FROM public.mcp_oauth_authorization WHERE client_id = prefix || 'pending';
  PERFORM public.mcp_oauth_purge_orphan_clients();
  IF EXISTS (SELECT 1 FROM public.mcp_oauth_client WHERE id = prefix || 'pending') THEN
    RAISE EXCEPTION 'FAIL: abandoned registration not reclaimed after authorization expiry';
  END IF;
  RAISE NOTICE 'ALL MCP OAUTH RETENTION ASSERTIONS PASSED';
END;
$$;
ROLLBACK;
