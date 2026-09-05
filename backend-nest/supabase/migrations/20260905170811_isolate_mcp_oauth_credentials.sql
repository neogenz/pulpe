-- pulpe:migration-phase expand
-- MCP credentials are opaque, hashed, and separate from the private Supabase session.
ALTER TABLE public.mcp_connection
  ADD COLUMN generation uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN encrypted_upstream text,
  ADD COLUMN grant_expires_at timestamptz;

-- Legacy connections must be associated again through the opaque issuer.
-- This does not invalidate native JWTs: retire legacy OAuth clients and wait
-- out their access-token lifetime before activation (see the cutover runbook).
UPDATE public.mcp_connection SET revoked_at = COALESCE(revoked_at, now()), wrapped_client_key = NULL;

CREATE TABLE public.mcp_oauth_client (
  id text PRIMARY KEY,
  encrypted_metadata text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.mcp_oauth_authorization (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL REFERENCES public.mcp_oauth_client(id) ON DELETE CASCADE,
  redirect_uri text NOT NULL,
  resource text NOT NULL,
  challenge text NOT NULL CHECK (challenge ~ '^[A-Za-z0-9_-]{43}$'),
  state text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approving', 'authorized', 'consumed', 'denied')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  connection_id uuid REFERENCES public.mcp_connection(id) ON DELETE CASCADE,
  generation uuid,
  code_hash text UNIQUE CHECK (code_hash ~ '^[0-9a-f]{64}$')
);

CREATE TABLE public.mcp_oauth_token (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.mcp_connection(id) ON DELETE CASCADE,
  generation uuid NOT NULL,
  access_hash text NOT NULL UNIQUE CHECK (access_hash ~ '^[0-9a-f]{64}$'),
  refresh_hash text NOT NULL UNIQUE CHECK (refresh_hash ~ '^[0-9a-f]{64}$'),
  access_expires_at timestamptz NOT NULL,
  refresh_expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  replaced_at timestamptz
);
CREATE INDEX mcp_oauth_authorization_expiry_idx ON public.mcp_oauth_authorization(expires_at);
CREATE INDEX mcp_oauth_authorization_client_idx ON public.mcp_oauth_authorization(client_id);
CREATE INDEX mcp_oauth_authorization_connection_idx ON public.mcp_oauth_authorization(connection_id);
CREATE INDEX mcp_oauth_token_connection_idx ON public.mcp_oauth_token(connection_id);
CREATE INDEX mcp_oauth_token_expiry_idx ON public.mcp_oauth_token(refresh_expires_at);

ALTER TABLE public.mcp_oauth_client ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_oauth_authorization ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_oauth_token ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mcp_oauth_client, public.mcp_oauth_authorization, public.mcp_oauth_token
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.mcp_oauth_client, public.mcp_oauth_authorization, public.mcp_oauth_token
  TO service_role;

-- Consent replaces the generation: old codes and tokens cannot revive after reconnection.
CREATE FUNCTION public.mcp_oauth_complete_authorization(
  p_id uuid, p_user_id uuid, p_client_name text, p_mode text,
  p_wrapped_key text, p_upstream text, p_code_hash text, p_generation uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  a public.mcp_oauth_authorization;
  connection uuid;
BEGIN
  SELECT * INTO a FROM public.mcp_oauth_authorization WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR a.status <> 'approving' OR a.expires_at <= now() THEN RETURN NULL; END IF;
  INSERT INTO public.mcp_connection
    (user_id, client_id, client_name, mode, wrapped_client_key, encrypted_upstream,
     generation, grant_expires_at, authorized_at, revoked_at)
  VALUES (p_user_id, a.client_id, p_client_name, p_mode, p_wrapped_key, p_upstream,
          p_generation, now() + interval '30 days', now(), NULL)
  ON CONFLICT (user_id, client_id) DO UPDATE SET
    client_name = EXCLUDED.client_name, mode = EXCLUDED.mode,
    wrapped_client_key = EXCLUDED.wrapped_client_key, encrypted_upstream = EXCLUDED.encrypted_upstream,
    generation = EXCLUDED.generation, grant_expires_at = EXCLUDED.grant_expires_at,
    authorized_at = EXCLUDED.authorized_at, revoked_at = NULL
  RETURNING id INTO connection;
  UPDATE public.mcp_oauth_authorization SET status = 'authorized', connection_id = connection,
    generation = p_generation, code_hash = p_code_hash, expires_at = now() + interval '1 minute'
  WHERE id = a.id;
  RETURN connection;
END;
$$;

-- One transaction owns the connection lock, consumes the code, and persists the tokens.
CREATE FUNCTION public.mcp_oauth_exchange_code(
  p_code_hash text, p_client_id text, p_redirect_uri text, p_resource text,
  p_access_hash text, p_refresh_hash text, p_access_expires_at timestamptz
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  a public.mcp_oauth_authorization;
  c public.mcp_connection;
BEGIN
  SELECT * INTO a FROM public.mcp_oauth_authorization
    WHERE code_hash = p_code_hash AND client_id = p_client_id;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT * INTO c FROM public.mcp_connection WHERE id = a.connection_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT * INTO a FROM public.mcp_oauth_authorization WHERE id = a.id FOR UPDATE;
  IF NOT FOUND OR a.status <> 'authorized' OR a.expires_at <= now()
    OR (p_redirect_uri IS NOT NULL AND a.redirect_uri <> p_redirect_uri) OR a.resource <> p_resource
    OR c.client_id <> p_client_id OR c.generation <> a.generation OR c.revoked_at IS NOT NULL
    OR c.wrapped_client_key IS NULL OR c.encrypted_upstream IS NULL
    OR c.grant_expires_at IS NULL OR c.grant_expires_at <= now()
    OR p_access_expires_at <= now() OR p_access_expires_at > c.grant_expires_at
  THEN RETURN false; END IF;
  INSERT INTO public.mcp_oauth_token
    (connection_id, generation, access_hash, refresh_hash, access_expires_at, refresh_expires_at)
  VALUES (c.id, c.generation, p_access_hash, p_refresh_hash, p_access_expires_at, c.grant_expires_at);
  UPDATE public.mcp_oauth_authorization SET status = 'consumed' WHERE id = a.id;
  RETURN true;
END;
$$;

-- A consumed refresh hash is retained until family expiry to detect replays across instances.
-- Return NULL rather than raising after revocation: raising would roll back the revocation.
CREATE FUNCTION public.mcp_oauth_claim_refresh(p_hash text, p_client_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  t public.mcp_oauth_token;
  c public.mcp_connection;
BEGIN
  SELECT * INTO t FROM public.mcp_oauth_token WHERE refresh_hash = p_hash;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO c FROM public.mcp_connection WHERE id = t.connection_id FOR UPDATE;
  IF NOT FOUND OR c.client_id <> p_client_id OR c.generation <> t.generation
    OR c.revoked_at IS NOT NULL OR c.encrypted_upstream IS NULL OR c.wrapped_client_key IS NULL
    OR c.grant_expires_at IS NULL OR c.grant_expires_at <= now()
  THEN RETURN NULL; END IF;
  SELECT * INTO t FROM public.mcp_oauth_token WHERE id = t.id FOR UPDATE;
  IF NOT FOUND OR t.refresh_expires_at <= now() THEN RETURN NULL; END IF;
  IF t.consumed_at IS NOT NULL THEN
    UPDATE public.mcp_connection SET revoked_at = now(), wrapped_client_key = NULL,
      encrypted_upstream = NULL WHERE id = c.id;
    RETURN NULL;
  END IF;
  UPDATE public.mcp_oauth_token SET consumed_at = now() WHERE id = t.id;
  RETURN jsonb_build_object('connection', to_jsonb(c), 'token_id', t.id);
END;
$$;

-- The network refresh happens outside SQL. Recheck the generation and revocation under lock.
CREATE FUNCTION public.mcp_oauth_finish_refresh(
  p_token_id uuid, p_upstream text, p_access_hash text, p_refresh_hash text,
  p_access_expires_at timestamptz
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  t public.mcp_oauth_token;
  c public.mcp_connection;
BEGIN
  SELECT * INTO t FROM public.mcp_oauth_token WHERE id = p_token_id;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT * INTO c FROM public.mcp_connection WHERE id = t.connection_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT * INTO t FROM public.mcp_oauth_token WHERE id = t.id FOR UPDATE;
  IF NOT FOUND OR c.generation <> t.generation OR c.revoked_at IS NOT NULL
    OR c.wrapped_client_key IS NULL OR c.encrypted_upstream IS NULL
    OR c.grant_expires_at IS NULL OR c.grant_expires_at <= now()
    OR t.consumed_at IS NULL OR t.replaced_at IS NOT NULL OR t.refresh_expires_at <= now()
    OR p_access_expires_at <= now() OR p_access_expires_at > c.grant_expires_at
  THEN RETURN false; END IF;
  INSERT INTO public.mcp_oauth_token
    (connection_id, generation, access_hash, refresh_hash, access_expires_at, refresh_expires_at)
  VALUES (c.id, c.generation, p_access_hash, p_refresh_hash, p_access_expires_at, t.refresh_expires_at);
  UPDATE public.mcp_connection SET encrypted_upstream = p_upstream WHERE id = c.id;
  UPDATE public.mcp_oauth_token SET replaced_at = now() WHERE id = t.id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.mcp_oauth_complete_authorization(uuid, uuid, text, text, text, text, text, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_oauth_exchange_code(text, text, text, text, text, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_oauth_claim_refresh(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_oauth_finish_refresh(uuid, text, text, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_oauth_complete_authorization(uuid, uuid, text, text, text, text, text, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_oauth_exchange_code(text, text, text, text, text, text, timestamptz)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_oauth_claim_refresh(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_oauth_finish_refresh(uuid, text, text, text, timestamptz) TO service_role;
