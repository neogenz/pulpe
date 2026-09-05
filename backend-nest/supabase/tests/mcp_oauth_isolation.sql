-- Disposable synthetic rows; every write is rolled back, including revocations.
BEGIN;
DO $$
DECLARE
  owner uuid := gen_random_uuid();
  client text := 'pulpe_' || gen_random_uuid();
  auth_id uuid;
  connection uuid;
  generation uuid := gen_random_uuid();
  claim jsonb;
  role_name text;
  object_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    FOREACH object_name IN ARRAY ARRAY['mcp_oauth_client', 'mcp_oauth_authorization', 'mcp_oauth_token'] LOOP
      IF has_table_privilege(role_name, 'public.' || object_name, 'SELECT, INSERT, UPDATE, DELETE') THEN
        RAISE EXCEPTION 'FAIL: OAuth storage exposed to %', role_name;
      END IF;
    END LOOP;
    FOR object_name IN SELECT p.oid::regprocedure::text FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname LIKE 'mcp_oauth_%'
    LOOP
      IF has_function_privilege(role_name, object_name, 'EXECUTE') THEN
        RAISE EXCEPTION 'FAIL: OAuth RPC exposed to %', role_name;
      END IF;
    END LOOP;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'mcp_oauth_%' AND p.prosecdef) THEN
    RAISE EXCEPTION 'FAIL: OAuth RPC must not bypass RLS';
  END IF;

  INSERT INTO auth.users (id, email, encrypted_password, instance_id, aud, role)
    VALUES (owner, owner || '@local.test', 'fake', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
  INSERT INTO public.mcp_oauth_client(id, encrypted_metadata) VALUES (client, 'synthetic metadata');
  INSERT INTO public.mcp_oauth_authorization(client_id, redirect_uri, resource, challenge, status)
    VALUES (client, 'https://client.test/cb', 'https://api.test/mcp', repeat('A', 43), 'approving') RETURNING id INTO auth_id;
  connection := public.mcp_oauth_complete_authorization(auth_id, owner, 'Test', 'read', 'wrapped', 'private', repeat('1', 64), generation);
  IF connection IS NULL THEN RAISE EXCEPTION 'FAIL: consent must complete'; END IF;
  IF public.mcp_oauth_complete_authorization(auth_id, owner, 'Test', 'read', 'wrapped', 'private', repeat('2', 64), generation) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: consent replay';
  END IF;

  IF public.mcp_oauth_exchange_code(repeat('1', 64), 'wrong-client', 'https://client.test/cb', 'https://api.test/mcp', repeat('a', 64), repeat('b', 64), now() + interval '1 hour')
    OR public.mcp_oauth_exchange_code(repeat('1', 64), client, 'https://other.test/cb', 'https://api.test/mcp', repeat('a', 64), repeat('b', 64), now() + interval '1 hour')
    OR public.mcp_oauth_exchange_code(repeat('1', 64), client, 'https://client.test/cb', 'https://other.test/mcp', repeat('a', 64), repeat('b', 64), now() + interval '1 hour')
  THEN RAISE EXCEPTION 'FAIL: code binding'; END IF;
  IF NOT public.mcp_oauth_exchange_code(repeat('1', 64), client, 'https://client.test/cb', 'https://api.test/mcp', repeat('a', 64), repeat('b', 64), now() + interval '1 hour') THEN
    RAISE EXCEPTION 'FAIL: legitimate code exchange';
  END IF;
  IF public.mcp_oauth_exchange_code(repeat('1', 64), client, 'https://client.test/cb', 'https://api.test/mcp', repeat('c', 64), repeat('d', 64), now() + interval '1 hour') THEN
    RAISE EXCEPTION 'FAIL: code replay';
  END IF;
  IF public.mcp_oauth_claim_refresh(repeat('b', 64), 'wrong-client') IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: wrong-client refresh';
  END IF;
  claim := public.mcp_oauth_claim_refresh(repeat('b', 64), client);
  IF claim IS NULL THEN RAISE EXCEPTION 'FAIL: refresh claim'; END IF;
  IF NOT public.mcp_oauth_finish_refresh((claim->>'token_id')::uuid, 'new-private', repeat('c', 64), repeat('d', 64), now() + interval '1 hour') THEN
    RAISE EXCEPTION 'FAIL: refresh completion';
  END IF;
  IF public.mcp_oauth_finish_refresh((claim->>'token_id')::uuid, 'new-private', repeat('e', 64), repeat('f', 64), now() + interval '1 hour') THEN
    RAISE EXCEPTION 'FAIL: duplicate refresh completion';
  END IF;
  IF public.mcp_oauth_claim_refresh(repeat('b', 64), client) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: refresh replay';
  END IF;
  IF EXISTS (SELECT 1 FROM public.mcp_connection WHERE id = connection
    AND (revoked_at IS NULL OR wrapped_client_key IS NOT NULL OR encrypted_upstream IS NOT NULL)) THEN
    RAISE EXCEPTION 'FAIL: replay must persist revocation and destroy private credentials';
  END IF;
  IF public.mcp_oauth_claim_refresh(repeat('d', 64), client) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: replay must invalidate the successor';
  END IF;

  generation := gen_random_uuid();
  INSERT INTO public.mcp_oauth_authorization(client_id, redirect_uri, resource, challenge, status)
    VALUES (client, 'https://client.test/cb', 'https://api.test/mcp', repeat('A', 43), 'approving') RETURNING id INTO auth_id;
  IF public.mcp_oauth_complete_authorization(auth_id, owner, 'Test', 'read_write', 'wrapped-new', 'private-new', repeat('3', 64), generation) <> connection THEN
    RAISE EXCEPTION 'FAIL: reconnection must retain its connection identity';
  END IF;
  IF public.mcp_oauth_claim_refresh(repeat('d', 64), client) IS NOT NULL
    OR EXISTS (SELECT 1 FROM public.mcp_connection WHERE id = connection AND revoked_at IS NOT NULL) THEN
    RAISE EXCEPTION 'FAIL: an old generation must neither revive nor revoke the new grant';
  END IF;

  BEGIN
    PERFORM public.mcp_oauth_exchange_code(repeat('3', 64), client, 'https://client.test/cb', 'https://api.test/mcp', repeat('a', 64), repeat('f', 64), now() + interval '1 hour');
    RAISE EXCEPTION 'FAIL: fixture must collide with the existing token';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  IF (SELECT status FROM public.mcp_oauth_authorization WHERE id = auth_id) <> 'authorized' THEN
    RAISE EXCEPTION 'FAIL: token insertion failure consumed the code';
  END IF;
  IF NOT public.mcp_oauth_exchange_code(repeat('3', 64), client, 'https://client.test/cb', 'https://api.test/mcp', repeat('e', 64), repeat('f', 64), now() + interval '1 hour') THEN
    RAISE EXCEPTION 'FAIL: reconnection exchange';
  END IF;
  claim := public.mcp_oauth_claim_refresh(repeat('f', 64), client);
  IF claim IS NULL THEN RAISE EXCEPTION 'FAIL: in-flight refresh setup'; END IF;
  UPDATE public.mcp_connection SET revoked_at = now(), wrapped_client_key = NULL, encrypted_upstream = NULL WHERE id = connection;
  IF public.mcp_oauth_finish_refresh((claim->>'token_id')::uuid, 'private-after-revoke', repeat('8', 64), repeat('9', 64), now() + interval '1 hour') THEN
    RAISE EXCEPTION 'FAIL: in-flight refresh restored revoked credentials';
  END IF;
  RAISE NOTICE 'ALL MCP OAUTH ISOLATION ASSERTIONS PASSED';
END;
$$;
ROLLBACK;
