import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  spyOn,
  setDefaultTimeout,
} from 'bun:test';
import { randomBytes, createHash } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import request from 'supertest';
import type {
  OAuthClientInformationFull,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import { AppModule } from '@/app.module';
import {
  setupApiVersioning,
  setupCors,
  setupMcpBearer,
  setupMcpOAuth,
} from '@/main';
import type { Database } from '@/types/database.types';
import {
  BudgetFormulas,
  getBudgetPeriodForDate,
  type BudgetLine,
  type Transaction,
} from 'pulpe-shared';
import { CurrencyService } from '@modules/currency/currency.service';
import {
  ensureSupabaseAvailable,
  IS_DEDICATED_INTEGRATION_RUN,
  type SupabaseEnv,
} from '@/test/local-supabase';
import { SupabaseMcpOAuthRepository } from '../persistence/supabase-mcp-oauth.repository';

const resource = 'http://127.0.0.1:46567/mcp';
const callback = 'https://client.example/cb';
const clientKey = 'aa'.repeat(32);
if (IS_DEDICATED_INTEGRATION_RUN) setDefaultTimeout(30_000);
type Owner = {
  id: string;
  token: string;
  templateId: string;
  budgetId: string;
};
type Grant = { code: string; verifier: string };

/** Only the dedicated integration run may create disposable accounts on local Supabase. */
describe.skipIf(!IS_DEDICATED_INTEGRATION_RUN)(
  'MCP isolated OAuth (real HTTP and Supabase)',
  () => {
    let app: INestApplication;
    let env: SupabaseEnv;
    let admin: SupabaseClient<Database>;
    let config: ConfigService;
    let nativeClientId: string | undefined;
    const owners: Owner[] = [];
    const clients: string[] = [];
    let client: OAuthClientInformationFull;
    let active: OAuthTokens;

    async function native(
      path: string,
      token: string,
      method = 'GET',
      body?: unknown,
    ) {
      return fetch(`${env.apiUrl}/auth/v1${path}`, {
        method,
        redirect: 'manual',
        signal: AbortSignal.timeout(10_000),
        headers: {
          apikey: env.anonKey,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    }

    async function boot() {
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(ConfigService)
        .useValue(config)
        .compile();
      app = moduleRef.createNestApplication({ logger: false });
      setupMcpOAuth(app);
      setupCors(app);
      setupMcpBearer(app);
      setupApiVersioning(app);
      await app.init();
    }

    beforeAll(async () => {
      env = await ensureSupabaseAvailable();
      // Never silently select another local project when a specific audit URL was requested.
      if (process.env.SUPABASE_URL && env.apiUrl !== process.env.SUPABASE_URL)
        throw new Error('Unexpected local Supabase target');
      admin = createClient<Database>(env.apiUrl, env.serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const upstream = await native(
        '/admin/oauth/clients',
        env.serviceRoleKey,
        'POST',
        {
          client_name: 'Pulpe MCP integration upstream',
          client_type: 'confidential',
          redirect_uris: [
            `${new URL(resource).origin}/mcp/oauth/upstream-callback`,
          ],
          token_endpoint_auth_method: 'client_secret_post',
        },
      );
      const registered = await upstream.json();
      nativeClientId = registered.client_id;
      expect(upstream.ok).toBe(true);
      config = new ConfigService({
        NODE_ENV: 'test',
        SUPABASE_URL: env.apiUrl,
        SUPABASE_ANON_KEY: env.anonKey,
        SUPABASE_SERVICE_ROLE_KEY: env.serviceRoleKey,
        ENCRYPTION_MASTER_KEY: '11'.repeat(32),
        MCP_WRAPPING_KEY: '22'.repeat(32),
        MCP_RESOURCE_URL: resource,
        MCP_CONSENT_URL: 'http://localhost:4200/mcp-consent',
        MCP_UPSTREAM_CLIENT_ID: nativeClientId,
        MCP_UPSTREAM_CLIENT_SECRET: registered.client_secret,
        TURNSTILE_SECRET_KEY: 'test',
        IOS_STORE_URL: 'https://apps.apple.com/app/pulpe',
      });
      await boot();
      for (let index = 0; index < 2; index++) {
        const email = `mcp-${crypto.randomUUID()}@local.test`;
        const password = randomBytes(32).toString('base64url');
        const created = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { firstName: 'Owner' },
        });
        if (created.error || !created.data.user)
          throw new Error('Cannot create local fixture');
        const owner = {
          id: created.data.user.id,
          token: '',
          templateId: '',
          budgetId: '',
        };
        owners.push(owner);
        const signedIn = await native(
          '/token?grant_type=password',
          env.anonKey,
          'POST',
          { email, password },
        );
        expect(signedIn.status).toBe(200);
        owner.token = (await signedIn.json()).access_token;
        await request(app.getHttpServer())
          .get('/api/v1/encryption/salt')
          .auth(owner.token, { type: 'bearer' })
          .expect(200);
        await request(app.getHttpServer())
          .post('/api/v1/encryption/setup-recovery')
          .auth(owner.token, { type: 'bearer' })
          .set('X-Client-Key', clientKey)
          .expect(201);
        const template = await admin
          .from('template')
          .insert({
            user_id: owner.id,
            name: 'MCP fixture',
            description: 'unchanged',
            is_default: false,
          })
          .select('id')
          .single();
        if (template.error) throw new Error('Cannot create local template');
        owner.templateId = template.data.id;
        const budget = await admin
          .from('monthly_budget')
          .insert({
            user_id: owner.id,
            template_id: owner.templateId,
            month: 9,
            year: 2026,
            description: 'MCP fixture',
          })
          .select('id')
          .single();
        if (budget.error) throw new Error('Cannot create local budget');
        owner.budgetId = budget.data.id;
      }
    });

    afterAll(async () => {
      app?.getHttpServer().closeAllConnections();
      await app?.close();
      if (admin) {
        for (const owner of owners) {
          const result = await admin.auth.admin.deleteUser(owner.id);
          expect(result.error === null).toBe(true);
        }
        if (clients.length) {
          const result = await admin
            .from('mcp_oauth_client')
            .delete()
            .in('id', clients);
          expect(result.error === null).toBe(true);
        }
      }
      if (nativeClientId)
        expect(
          (
            await native(
              `/admin/oauth/clients/${nativeClientId}`,
              env.serviceRoleKey,
              'DELETE',
            )
          ).ok,
        ).toBe(true);
    });

    async function register(method = 'none') {
      const response = await request(app.getHttpServer())
        .post('/register')
        .send({
          client_name: 'Integration client',
          redirect_uris: [callback],
          grant_types: ['authorization_code', 'refresh_token'],
          token_endpoint_auth_method: method,
        })
        .expect(201);
      const registered = response.body as OAuthClientInformationFull;
      clients.push(registered.client_id);
      expect(registered.client_id.startsWith('pulpe_')).toBe(true);
      return registered;
    }

    async function authorize(
      registered: OAuthClientInformationFull,
      owner = owners[0],
      mode = 'read_write',
      key = clientKey,
    ): Promise<Grant> {
      const { id, state, verifier } = await startAuthorization(registered);
      const details = await request(app.getHttpServer())
        .get(`/api/v1/mcp/consent/${id}`)
        .auth(owner.token, { type: 'bearer' })
        .expect(200);
      expect(details.body.clientName).toBe('Integration client');
      const consent = await request(app.getHttpServer())
        .post(`/api/v1/mcp/consent/${id}/approve`)
        .auth(owner.token, { type: 'bearer' })
        .set('X-Client-Key', key)
        .send({ mode })
        .expect(201);
      const redirect = new URL(consent.body.redirectUrl);
      expect(redirect.origin).toBe(new URL(callback).origin);
      expect(redirect.searchParams.get('state') === state).toBe(true);
      const code = redirect.searchParams.get('code')!;
      expect(/^mcp_ac_[A-Za-z0-9_-]{43}$/.test(code)).toBe(true);
      return { code, verifier };
    }

    async function startAuthorization(
      registered: OAuthClientInformationFull,
      redirectUri: string | null = callback,
    ) {
      const verifier = randomBytes(32).toString('base64url');
      const state = randomBytes(16).toString('hex');
      const authorization = await request(app.getHttpServer())
        .get('/authorize')
        .query({
          client_id: registered.client_id,
          ...(redirectUri === null ? {} : { redirect_uri: redirectUri }),
          response_type: 'code',
          code_challenge_method: 'S256',
          code_challenge: createHash('sha256')
            .update(verifier)
            .digest('base64url'),
          state,
          resource,
        })
        .expect(302);
      const id = new URL(authorization.headers.location).searchParams.get(
        'authorization_id',
      );
      expect(!!id).toBe(true);
      return { id: id!, state, verifier };
    }

    function exchange(
      registered: OAuthClientInformationFull,
      grant: Grant,
      overrides: Record<string, string | undefined> = {},
    ) {
      return request(app.getHttpServer())
        .post('/token')
        .type('form')
        .send({
          grant_type: 'authorization_code',
          client_id: registered.client_id,
          client_secret: registered.client_secret,
          redirect_uri: callback,
          resource,
          code: grant.code,
          code_verifier: grant.verifier,
          ...overrides,
        });
    }

    function refresh(registered: OAuthClientInformationFull, token: string) {
      return request(app.getHttpServer()).post('/token').type('form').send({
        grant_type: 'refresh_token',
        client_id: registered.client_id,
        client_secret: registered.client_secret,
        refresh_token: token,
        resource,
      });
    }

    function mcp(token: string, method = 'tools/list', params?: unknown) {
      return request(app.getHttpServer())
        .post('/mcp')
        .auth(token, { type: 'bearer' })
        .set('Accept', 'application/json, text/event-stream')
        .send({ jsonrpc: '2.0', id: 1, method, params });
    }

    async function callTool(
      token: string,
      name: string,
      args: Record<string, unknown> = {},
    ) {
      const response = await mcp(token, 'tools/call', {
        name,
        arguments: args,
      }).expect(200);
      expect(response.body.error).toBeUndefined();
      expect(response.body.result.isError ?? false).toBe(false);
      return response.body.result.content[0].text as string;
    }

    function resultId(text: string) {
      const id = text.match(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
      )?.[0];
      expect(!!id).toBe(true);
      return id!;
    }

    function opaque(tokens: OAuthTokens) {
      expect(/^mcp_at_[A-Za-z0-9_-]{43}$/.test(tokens.access_token)).toBe(true);
      expect(
        /^mcp_rt_[A-Za-z0-9_-]{43}$/.test(tokens.refresh_token ?? ''),
      ).toBe(true);
      expect(Object.keys(tokens).sort()).toEqual([
        'access_token',
        'expires_in',
        'refresh_token',
        'scope',
        'token_type',
      ]);
    }

    it('associates through the production consent API and lists the 15 tools with an opaque credential', async () => {
      const preflight = await request(app.getHttpServer())
        .options('/mcp')
        .set('Origin', 'https://assistant.example')
        .set('Access-Control-Request-Method', 'POST')
        .set(
          'Access-Control-Request-Headers',
          'authorization,mcp-protocol-version',
        )
        .expect(204);
      expect(preflight.headers['access-control-allow-origin']).toBe('*');
      expect(
        preflight.headers['access-control-allow-credentials'],
      ).toBeUndefined();
      const missing = await request(app.getHttpServer())
        .post('/mcp')
        .send({})
        .expect(401);
      expect(missing.headers['www-authenticate']).toContain(
        `${new URL(resource).origin}/.well-known/oauth-protected-resource/mcp`,
      );
      const metadata = await request(app.getHttpServer())
        .get('/.well-known/oauth-authorization-server')
        .expect(200);
      expect(metadata.body.issuer).toBe(`${new URL(resource).origin}/`);
      client = await register();
      const result = await exchange(client, await authorize(client)).expect(
        200,
      );
      active = result.body;
      opaque(active);
      expect(result.headers['cache-control']).toContain('no-store');
      const initialized = await mcp(active.access_token, 'initialize', {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'test', version: '1' },
      }).expect(200);
      expect(initialized.body.result.serverInfo.name).toBe('pulpe');
      const catalog = await mcp(active.access_token).expect(200);
      expect(catalog.body.result.tools).toHaveLength(15);
    });

    it('rejects unsafe redirect registrations and keeps the native public registration route closed', async () => {
      for (const redirect of [
        'http://remote.example/cb',
        'https://client.example/cb#fragment',
        'https://name:password@client.example/cb',
        'http://localhost:4200/cb#fragment',
      ]) {
        await request(app.getHttpServer())
          .post('/register')
          .send({
            client_name: 'Invalid fixture',
            redirect_uris: [redirect],
            token_endpoint_auth_method: 'none',
          })
          .expect(400);
      }
      const nativeRegistration = await native(
        '/oauth/clients/register',
        env.anonKey,
        'POST',
        {
          client_name: 'Forbidden native registration',
          redirect_uris: [callback],
          grant_types: ['authorization_code', 'refresh_token'],
          response_types: ['code'],
          token_endpoint_auth_method: 'none',
        },
      );
      expect(nativeRegistration.status).toBe(403);
    });

    it('rejects direct Auth, table, RPC and GraphQL calls with the external bearer while the first-party session works', async () => {
      expect(
        [401, 403].includes(
          (
            await native('/user', active.access_token, 'PUT', {
              data: { firstName: 'changed' },
            })
          ).status,
        ),
      ).toBe(true);
      for (const [path, body, method] of [
        [
          `/rest/v1/template?id=eq.${owners[0].templateId}`,
          { description: 'changed' },
          'PATCH',
        ],
        [
          '/rest/v1/rpc/toggle_transaction_check',
          { p_transaction_id: crypto.randomUUID() },
          'POST',
        ],
        [
          '/rest/v1/rpc/reconcile_savings_goal_target_date',
          { p_user_id: owners[0].id },
          'POST',
        ],
        ['/graphql/v1', { query: '{ __typename }' }, 'POST'],
      ] as const) {
        const response = await fetch(`${env.apiUrl}${path}`, {
          method,
          headers: {
            apikey: env.anonKey,
            Authorization: `Bearer ${active.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });
        expect([401, 403].includes(response.status)).toBe(true);
      }
      const owner = await native('/user', owners[0].token);
      expect(owner.status).toBe(200);
      expect((await owner.json()).user_metadata.firstName).toBe('Owner');
      const unchanged = await admin
        .from('template')
        .select('description')
        .eq('id', owners[0].templateId)
        .single();
      expect(unchanged.data?.description).toBe('unchanged');
      await request(app.getHttpServer())
        .get('/api/v1/mcp/connections')
        .auth(active.access_token, { type: 'bearer' })
        .expect(401);
      await request(app.getHttpServer())
        .get('/api/v1/mcp/connections')
        .auth(owners[0].token, { type: 'bearer' })
        .expect(200);
      const stored = await admin
        .from('mcp_connection')
        .select('*')
        .eq('user_id', owners[0].id)
        .eq('client_id', client.client_id)
        .single();
      const row = stored.data!;
      const internal = app.get(SupabaseMcpOAuthRepository).readSession({
        ...row,
        encrypted_upstream: row.encrypted_upstream!,
        grant_expires_at: row.grant_expires_at!,
      });
      await mcp(internal.accessToken).expect(401);
      await mcp(owners[0].token).expect(401);
      expect(JSON.stringify(active).includes(internal.accessToken)).toBe(false);
      expect(JSON.stringify(active).includes(internal.refreshToken)).toBe(
        false,
      );
      expect(row.encrypted_upstream!.includes(internal.refreshToken)).toBe(
        false,
      );
    });

    it('renews after a backend restart and revokes the token family on refresh replay', async () => {
      app.getHttpServer().closeAllConnections();
      await app.close();
      await boot();
      const result = await refresh(client, active.refresh_token!).expect(200);
      opaque(result.body);
      await mcp(result.body.access_token).expect(200);
      await refresh(client, active.refresh_token!).expect(400);
      await mcp(result.body.access_token).expect(401);
      await refresh(client, result.body.refresh_token).expect(400);
    });

    it('binds single-use codes to client, redirect, resource and PKCE, including simultaneous exchanges', async () => {
      const other = await register('client_secret_post');
      const grant = await authorize(client);
      await exchange(other, grant).expect(400);
      await exchange(client, grant, {
        redirect_uri: `${callback}/wrong`,
      }).expect(400);
      await exchange(client, grant, {
        resource: 'https://another.example/mcp',
      }).expect(400);
      await exchange(client, grant, {
        code_verifier: randomBytes(32).toString('base64url'),
      }).expect(400);
      const exchanged = await Promise.all([
        exchange(client, grant),
        exchange(client, grant),
      ]);
      expect(exchanged.map((response) => response.status).sort()).toEqual([
        200, 400,
      ]);
      active = exchanged.find((response) => response.status === 200)!.body;
      await exchange(client, grant).expect(400);
      await refresh(other, active.refresh_token!).expect(400);
      await mcp(active.access_token).expect(200);
      const confidentialGrant = await authorize(other);
      await exchange(other, confidentialGrant, {
        client_secret: 'incorrect',
      }).expect(400);
      const confidential = await exchange(other, confidentialGrant).expect(200);
      opaque(confidential.body);
      await request(app.getHttpServer())
        .post('/revoke')
        .type('form')
        .send({
          client_id: other.client_id,
          client_secret: other.client_secret,
          token: confidential.body.refresh_token,
        })
        .expect(200);
      await mcp(confidential.body.access_token).expect(401);
    });

    it('writes encrypted owner data, reads it back, rejects cross-owner writes and records no financial arguments', async () => {
      const args = {
        budgetId: owners[0].budgetId,
        name: 'Isolated test expense',
        amount: 123.45,
        kind: 'expense',
      };
      const added = await mcp(active.access_token, 'tools/call', {
        name: 'add_movement',
        arguments: args,
      }).expect(200);
      expect(added.body.result.isError ?? false).toBe(false);
      const rows = await admin
        .from('transaction')
        .select('id, amount')
        .eq('budget_id', owners[0].budgetId);
      expect(rows.error === null).toBe(true);
      expect(rows.data).toHaveLength(1);
      expect(rows.data![0].amount === '123.45').toBe(false);
      const normal = await request(app.getHttpServer())
        .get(`/api/v1/transactions/budget/${owners[0].budgetId}`)
        .auth(owners[0].token, { type: 'bearer' })
        .set('X-Client-Key', clientKey)
        .expect(200);
      expect(normal.body.data[0].amount).toBe(123.45);
      const report = await mcp(active.access_token, 'tools/call', {
        name: 'get_month',
        arguments: { month: 9, year: 2026 },
      }).expect(200);
      expect(report.body.result.isError ?? false).toBe(false);
      expect(report.body.result.content[0].text).toContain(
        'Isolated test expense',
      );
      const denied = await mcp(active.access_token, 'tools/call', {
        name: 'add_movement',
        arguments: { ...args, budgetId: owners[1].budgetId },
      }).expect(200);
      expect(denied.body.result.isError).toBe(true);
      const otherRows = await admin
        .from('transaction')
        .select('id')
        .eq('budget_id', owners[1].budgetId);
      expect(otherRows.data).toHaveLength(0);
      const activity = await admin
        .from('mcp_activity')
        .select('*')
        .eq('user_id', owners[0].id)
        .order('created_at');
      expect(activity.error === null).toBe(true);
      expect(activity.data?.map((entry) => entry.outcome)).toEqual([
        'ok',
        'error',
      ]);
      expect(JSON.stringify(activity.data).includes(args.name)).toBe(false);
      expect(JSON.stringify(activity.data).includes(String(args.amount))).toBe(
        false,
      );
    });

    it('enforces a downgraded read-only grant and owner-only revocation without reviving old credentials', async () => {
      const previous = active;
      active = (
        await exchange(
          client,
          await authorize(client, owners[0], 'read'),
        ).expect(200)
      ).body;
      await mcp(previous.access_token).expect(401);
      await refresh(client, previous.refresh_token!).expect(400);
      const catalog = await mcp(active.access_token).expect(200);
      expect(catalog.body.result.tools).toHaveLength(7);
      expect(
        catalog.body.result.tools.every(
          (tool: { annotations: { readOnlyHint: boolean } }) =>
            tool.annotations.readOnlyHint,
        ),
      ).toBe(true);
      const denied = await mcp(active.access_token, 'tools/call', {
        name: 'add_movement',
        arguments: {
          budgetId: owners[0].budgetId,
          name: 'Forbidden',
          amount: 7,
          kind: 'expense',
        },
      }).expect(200);
      expect(!!denied.body.error || denied.body.result?.isError === true).toBe(
        true,
      );
      const rows = await admin
        .from('transaction')
        .select('id')
        .eq('budget_id', owners[0].budgetId);
      expect(rows.data).toHaveLength(1);
      const connection = await admin
        .from('mcp_connection')
        .select('id')
        .eq('user_id', owners[0].id)
        .eq('client_id', client.client_id)
        .single();
      await request(app.getHttpServer())
        .delete(`/api/v1/mcp/connections/${connection.data!.id}`)
        .auth(owners[1].token, { type: 'bearer' })
        .expect(404);
      await mcp(active.access_token).expect(200);
      await request(app.getHttpServer())
        .delete(`/api/v1/mcp/connections/${connection.data!.id}`)
        .auth(owners[0].token, { type: 'bearer' })
        .expect(204);
      await mcp(active.access_token).expect(401);
      await refresh(client, active.refresh_token!).expect(400);
      const destroyed = await admin
        .from('mcp_connection')
        .select('wrapped_client_key, encrypted_upstream')
        .eq('id', connection.data!.id)
        .single();
      expect(destroyed.data).toEqual({
        wrapped_client_key: null,
        encrypted_upstream: null,
      });
      expect((await native('/user', owners[0].token)).status).toBe(200);
    });

    it('fails closed on simultaneous refresh replay and leaves a later reconnection usable', async () => {
      const tokens = (
        await exchange(client, await authorize(client)).expect(200)
      ).body as OAuthTokens;
      const results = await Promise.all([
        refresh(client, tokens.refresh_token!),
        refresh(client, tokens.refresh_token!),
      ]);
      expect(
        results.filter((result) => result.status === 200).length,
      ).toBeLessThanOrEqual(1);
      expect(results.some((result) => result.status === 400)).toBe(true);
      for (const result of results.filter((result) => result.status === 200))
        await mcp(result.body.access_token).expect(401);
      await mcp(tokens.access_token).expect(401);
      const renewed = (
        await exchange(client, await authorize(client)).expect(200)
      ).body;
      await refresh(client, tokens.refresh_token!).expect(400);
      await mcp(renewed.access_token).expect(200);
    });

    it('rejects missing authentication, wrong vault keys, expired requests and direct native authorization identifiers', async () => {
      const pending = await startAuthorization(client);
      await request(app.getHttpServer())
        .get(`/api/v1/mcp/consent/${pending.id}`)
        .expect(401);
      const wrong = await request(app.getHttpServer())
        .post(`/api/v1/mcp/consent/${pending.id}/approve`)
        .auth(owners[0].token, { type: 'bearer' })
        .set('X-Client-Key', 'bb'.repeat(32))
        .send({ mode: 'read_write' });
      expect(wrong.status >= 400 && wrong.status < 500).toBe(true);
      expect('redirectUrl' in wrong.body).toBe(false);
      const row = await admin
        .from('mcp_oauth_authorization')
        .select('status')
        .eq('id', pending.id)
        .single();
      expect(row.data?.status).toBe('pending');
      const expired = await admin
        .from('mcp_oauth_authorization')
        .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
        .eq('id', pending.id);
      expect(expired.error === null).toBe(true);
      for (const id of [pending.id, crypto.randomUUID()]) {
        const response = await request(app.getHttpServer())
          .post(`/api/v1/mcp/consent/${id}/approve`)
          .auth(owners[0].token, { type: 'bearer' })
          .set('X-Client-Key', clientKey)
          .send({ mode: 'read_write' });
        expect(response.status >= 400 && response.status < 500).toBe(true);
        expect('redirectUrl' in response.body).toBe(false);
      }
      const denied = await startAuthorization(client);
      const response = await request(app.getHttpServer())
        .post(`/api/v1/mcp/consent/${denied.id}/deny`)
        .auth(owners[0].token, { type: 'bearer' })
        .expect(201);
      const redirect = new URL(response.body.redirectUrl);
      expect(redirect.origin).toBe(new URL(callback).origin);
      expect(redirect.searchParams.get('error')).toBe('access_denied');
      expect(redirect.searchParams.get('state') === denied.state).toBe(true);
      expect(redirect.searchParams.has('code')).toBe(false);
    });

    it('expires access and refresh credentials and preserves ordinary authentication when MCP is disabled', async () => {
      const tokens = (
        await exchange(client, await authorize(client)).expect(200)
      ).body as OAuthTokens;
      const connection = await admin
        .from('mcp_connection')
        .select('id')
        .eq('user_id', owners[0].id)
        .eq('client_id', client.client_id)
        .single();
      const expired = await admin
        .from('mcp_connection')
        .update({ grant_expires_at: new Date(Date.now() - 1000).toISOString() })
        .eq('id', connection.data!.id);
      expect(expired.error === null).toBe(true);
      await mcp(tokens.access_token).expect(401);
      await refresh(client, tokens.refresh_token!).expect(400);
      const renewed = (
        await exchange(client, await authorize(client)).expect(200)
      ).body;
      const previousEnvironmentId = process.env.MCP_UPSTREAM_CLIENT_ID;
      config.set('MCP_UPSTREAM_CLIENT_ID', '');
      try {
        await mcp(renewed.access_token).expect(401);
        await request(app.getHttpServer())
          .get('/api/v1/mcp/connections')
          .auth(owners[0].token, { type: 'bearer' })
          .expect(200);
      } finally {
        config.set('MCP_UPSTREAM_CLIENT_ID', nativeClientId);
        if (previousEnvironmentId === undefined)
          delete process.env.MCP_UPSTREAM_CLIENT_ID;
        else process.env.MCP_UPSTREAM_CLIENT_ID = previousEnvironmentId;
      }
      await mcp(renewed.access_token).expect(200);
    });

    it('destroys private sessions on vault-code change and recovery without losing encrypted owner data', async () => {
      const tokens = (
        await exchange(client, await authorize(client)).expect(200)
      ).body as OAuthTokens;
      const newKey = 'cc'.repeat(32);
      const changed = await request(app.getHttpServer())
        .post('/api/v1/encryption/change-pin')
        .auth(owners[0].token, { type: 'bearer' })
        .send({ oldClientKey: clientKey, newClientKey: newKey })
        .expect(200);
      await mcp(tokens.access_token).expect(401);
      await refresh(client, tokens.refresh_token!).expect(400);
      const reconnected = (
        await exchange(
          client,
          await authorize(client, owners[0], 'read_write', newKey),
        ).expect(200)
      ).body;
      const recoveryKey = changed.body.recoveryKey;
      expect(typeof recoveryKey === 'string').toBe(true);
      await request(app.getHttpServer())
        .post('/api/v1/encryption/recover')
        .auth(owners[0].token, { type: 'bearer' })
        .send({ recoveryKey, newClientKey: clientKey })
        .expect(200);
      await mcp(reconnected.access_token).expect(401);
      await refresh(client, reconnected.refresh_token).expect(400);
      const destroyed = await admin
        .from('mcp_connection')
        .select('wrapped_client_key, encrypted_upstream')
        .eq('user_id', owners[0].id);
      expect(
        destroyed.data?.every(
          (row) =>
            row.wrapped_client_key === null && row.encrypted_upstream === null,
        ),
      ).toBe(true);
      const normal = await request(app.getHttpServer())
        .get(`/api/v1/transactions/budget/${owners[0].budgetId}`)
        .auth(owners[0].token, { type: 'bearer' })
        .set('X-Client-Key', clientKey)
        .expect(200);
      expect(normal.body.data[0].amount).toBe(123.45);
    });

    it('allows a legitimate refresh retry after a transient upstream failure, without weakening completed-token replay detection', async () => {
      const tokens = (
        await exchange(client, await authorize(client)).expect(200)
      ).body as OAuthTokens;
      const originalFetch = globalThis.fetch;
      const unavailable = spyOn(globalThis, 'fetch').mockImplementation(((
        input: RequestInfo | URL,
        options?: RequestInit,
      ) => {
        if (String(input) === `${env.apiUrl}/auth/v1/oauth/token`)
          return Promise.resolve(new Response(null, { status: 503 }));
        return originalFetch(input, options);
      }) as typeof fetch);
      try {
        await refresh(client, tokens.refresh_token!).expect(500);
      } finally {
        unavailable.mockRestore();
      }
      await mcp(tokens.access_token).expect(200);
      const retried = await refresh(client, tokens.refresh_token!).expect(200);
      await mcp(retried.body.access_token).expect(200);
      await refresh(client, tokens.refresh_token!).expect(400);
      await mcp(retried.body.access_token).expect(401);
    });

    it('supports the SDK single-URI redirect default at both authorization and exchange', async () => {
      const pending = await startAuthorization(client, null);
      const consent = await request(app.getHttpServer())
        .post(`/api/v1/mcp/consent/${pending.id}/approve`)
        .auth(owners[0].token, { type: 'bearer' })
        .set('X-Client-Key', clientKey)
        .send({ mode: 'read' })
        .expect(201);
      const code = new URL(consent.body.redirectUrl).searchParams.get('code')!;
      const tokens = await exchange(
        client,
        { code, verifier: pending.verifier },
        { redirect_uri: undefined },
      ).expect(200);
      await mcp(tokens.body.access_token).expect(200);
    });

    it('does not let an in-flight refresh restore a connection revoked through Pulpe', async () => {
      const tokens = (
        await exchange(client, await authorize(client)).expect(200)
      ).body as OAuthTokens;
      const row = await admin
        .from('mcp_connection')
        .select('id')
        .eq('user_id', owners[0].id)
        .eq('client_id', client.client_id)
        .single();
      const [rotated, revoked] = await Promise.all([
        refresh(client, tokens.refresh_token!),
        request(app.getHttpServer())
          .delete(`/api/v1/mcp/connections/${row.data!.id}`)
          .auth(owners[0].token, { type: 'bearer' }),
      ]);
      expect(revoked.status).toBe(204);
      expect([200, 400].includes(rotated.status)).toBe(true);
      await mcp(tokens.access_token).expect(401);
      if (rotated.status === 200) {
        await mcp(rotated.body.access_token).expect(401);
        await refresh(client, rotated.body.refresh_token).expect(400);
      }
    });
    it('advertises all 15 tools honestly and refuses every write tool in read-only mode', async () => {
      app.getHttpServer().closeAllConnections();
      await app.close();
      await boot();
      const token = (
        await exchange(client, await authorize(client, owners[1])).expect(200)
      ).body.access_token;
      const catalog = (await mcp(token).expect(200)).body.result.tools;
      const reads = [
        'get_current_month',
        'get_month',
        'list_months',
        'list_templates',
        'search_movements',
        'list_savings_goals',
        'get_savings_goal_outlook',
      ];
      const writes = [
        'add_movement',
        'update_movement',
        'delete_movement',
        'add_forecast',
        'update_forecast',
        'create_month_from_template',
        'spread_expense',
        'toggle_check',
      ];
      const destructive = [
        'update_movement',
        'delete_movement',
        'update_forecast',
        'spread_expense',
        'toggle_check',
      ];
      expect(catalog.map((tool: { name: string }) => tool.name).sort()).toEqual(
        [...reads, ...writes].sort(),
      );
      for (const tool of catalog) {
        expect(tool.annotations.readOnlyHint).toBe(reads.includes(tool.name));
        expect(tool.annotations.destructiveHint).toBe(
          destructive.includes(tool.name),
        );
        expect(tool.annotations.idempotentHint).toBe(
          reads.includes(tool.name) ||
            ['update_movement', 'update_forecast', 'delete_movement'].includes(
              tool.name,
            ),
        );
        expect(tool.annotations.openWorldHint).toBe(false);
      }
      const readOnly = (
        await exchange(
          client,
          await authorize(client, owners[1], 'read'),
        ).expect(200)
      ).body.access_token;
      const limited = (await mcp(readOnly).expect(200)).body.result.tools;
      expect(limited.map((tool: { name: string }) => tool.name).sort()).toEqual(
        reads.sort(),
      );
      for (const name of writes) {
        const denied = await mcp(readOnly, 'tools/call', {
          name,
          arguments: {},
        }).expect(200);
        expect(
          !!denied.body.error || denied.body.result?.isError === true,
        ).toBe(true);
      }
      const untouched = await admin
        .from('transaction')
        .select('id')
        .eq('budget_id', owners[1].budgetId);
      expect(untouched.data).toHaveLength(0);
    });

    it('clears old conversion metadata on account-currency amount edits while retaining it on name-only edits', async () => {
      const owner = owners[1];
      const token = (
        await exchange(client, await authorize(client, owner)).expect(200)
      ).body.access_token;
      const quote = spyOn(
        app.get(CurrencyService),
        'getRate',
      ).mockImplementation(async (base, target) => ({
        base,
        target,
        rate: 0.94,
        date: '2026-09-05',
      }));
      try {
        for (const kind of ['movement', 'forecast'] as const) {
          const id = resultId(
            await callTool(token, `add_${kind}`, {
              budgetId: owner.budgetId,
              name: `FX ${kind}`,
              amount: 100,
              currency: 'EUR',
              kind: 'expense',
              ...(kind === 'forecast' ? { recurrence: 'one_off' } : {}),
            }),
          );
          const identity =
            kind === 'movement' ? { movementId: id } : { forecastId: id };
          const path = `/api/v1/${kind === 'movement' ? 'transactions' : 'budget-lines'}/${id}`;
          const read = async () =>
            (
              await request(app.getHttpServer())
                .get(path)
                .auth(owner.token, { type: 'bearer' })
                .set('X-Client-Key', clientKey)
                .expect(200)
            ).body.data;
          expect(await read()).toMatchObject({
            amount: 94,
            originalAmount: 100,
            originalCurrency: 'EUR',
            targetCurrency: 'CHF',
            exchangeRate: 0.94,
          });
          await callTool(token, `update_${kind}`, {
            ...identity,
            name: `Renamed FX ${kind}`,
          });
          expect(await read()).toMatchObject({
            amount: 94,
            originalAmount: 100,
            originalCurrency: 'EUR',
          });
          for (const currency of [undefined, 'CHF']) {
            if (currency)
              await callTool(token, `update_${kind}`, {
                ...identity,
                amount: 100,
                currency: 'EUR',
              });
            await callTool(token, `update_${kind}`, {
              ...identity,
              amount: 70,
              ...(currency ? { currency } : {}),
            });
            const updated = await read();
            expect(updated.amount).toBe(70);
            expect(updated.originalAmount).toBeUndefined();
            expect(updated.originalCurrency).toBeUndefined();
            expect(updated.exchangeRate).toBeUndefined();
            expect(updated.targetCurrency).toBe('CHF');
          }
        }
      } finally {
        quote.mockRestore();
      }
    });

    it('executes all 15 tools on encrypted owner data with matching month and savings figures and non-mutating missing-input replies', async () => {
      const owner = owners[1];
      const token = (
        await exchange(client, await authorize(client, owner)).expect(200)
      ).body.access_token;
      const used = new Set<string>();
      const call = async (name: string, args: Record<string, unknown> = {}) => {
        used.add(name);
        return callTool(token, name, args);
      };
      const normal = async (path: string) =>
        (
          await request(app.getHttpServer())
            .get(`/api/v1/${path}`)
            .auth(owner.token, { type: 'bearer' })
            .set('X-Client-Key', clientKey)
            .expect(200)
        ).body.data;
      const period = getBudgetPeriodForDate(new Date(), null);
      const future = { month: period.month, year: period.year + 1 };
      const current = await admin
        .from('monthly_budget')
        .select('id')
        .eq('user_id', owner.id)
        .eq('month', period.month)
        .eq('year', period.year)
        .maybeSingle();
      expect(current.error === null).toBe(true);
      const budgetId =
        current.data?.id ??
        resultId(
          await call('create_month_from_template', {
            ...period,
            templateId: owner.templateId,
          }),
        );
      const before = await normal(`budgets/${budgetId}/details`);
      expect(await call('create_month_from_template', future)).toContain(
        'Information manquante',
      );
      expect(
        await call('add_forecast', {
          budgetId,
          name: 'Needs frequency',
          amount: 15,
          kind: 'expense',
        }),
      ).toContain('Information manquante');
      expect(
        await call('add_movement', {
          budgetId,
          name: 'Needs allocation',
          amount: 15,
          kind: 'saving',
        }),
      ).toContain('Information manquante');
      const after = await normal(`budgets/${budgetId}/details`);
      expect(after.budgetLines).toHaveLength(before.budgetLines.length);
      expect(after.transactions).toHaveLength(before.transactions.length);
      const absentFuture = await admin
        .from('monthly_budget')
        .select('id')
        .eq('user_id', owner.id)
        .eq('month', future.month)
        .eq('year', future.year);
      expect(absentFuture.data).toHaveLength(0);
      const futureId = resultId(
        await call('create_month_from_template', {
          ...future,
          templateId: owner.templateId,
        }),
      );
      expect(await call('list_templates')).toContain(owner.templateId);
      const rentId = resultId(
        await call('add_forecast', {
          budgetId,
          name: 'Matrix rent',
          amount: 300,
          kind: 'expense',
          recurrence: 'one_off',
        }),
      );
      await call('update_forecast', { forecastId: rentId, amount: 240 });
      expect(
        await call('toggle_check', { id: rentId, target: 'forecast' }),
      ).toContain('Pointé');
      expect(
        await call('toggle_check', { id: rentId, target: 'forecast' }),
      ).toContain('À pointer');
      const expenseId = resultId(
        await call('add_movement', {
          budgetId,
          name: 'Matrix expense',
          amount: 25,
          kind: 'expense',
        }),
      );
      await call('update_movement', { movementId: expenseId, amount: 35 });
      expect((await normal(`transactions/${expenseId}`)).amount).toBe(35);
      const goalResponse = await request(app.getHttpServer())
        .post('/api/v1/savings-goals')
        .auth(owner.token, { type: 'bearer' })
        .set('X-Client-Key', clientKey)
        .send({
          name: 'Matrix reserve',
          targetAmount: 1000,
          initialAmount: 100,
          startDate: `${period.year}-${String(period.month).padStart(2, '0')}-01`,
          targetDate: `${future.year}-${String(future.month).padStart(2, '0')}-01`,
        })
        .expect(201);
      const goalId = goalResponse.body.data.id;
      const savingId = resultId(
        await call('add_forecast', {
          budgetId,
          name: 'Matrix saving',
          amount: 50,
          kind: 'saving',
          recurrence: 'fixed',
          savingsGoalId: goalId,
        }),
      );
      const contributionId = resultId(
        await call('add_movement', {
          budgetId,
          name: 'Matrix contribution',
          amount: 20,
          kind: 'saving',
          budgetLineId: savingId,
          transactionDate: new Date(
            Date.UTC(period.year, period.month - 1, 1, 12),
          ).toISOString(),
        }),
      );
      await call('toggle_check', { id: contributionId, target: 'movement' });
      const progress = await normal(`savings-goals/${goalId}/progress`);
      const outlook = await call('get_savings_goal_outlook', {
        savingsGoalId: goalId,
      });
      const round = (value: number) => Number(value.toFixed(2));
      expect(outlook).toContain(
        `Confirmé ${round(progress.confirmed)} · Prévu cumulé ${round(progress.plannedCumulative)} · Projection ${round(progress.plannedProjection)}`,
      );
      expect(outlook).toContain(
        `Rythme prévu ${round(progress.pace)} par mois · rythme confirmé ${round(progress.confirmedPace)} par mois`,
      );
      expect(await call('list_savings_goals')).toContain(
        'Matrix reserve · cible 1000',
      );
      const spread = await call('spread_expense', {
        forecastId: rentId,
        months: [period, future],
      });
      expect(spread).toContain('Dépense lissée sur 2 mois');
      const splitCurrent = await normal(`budgets/${budgetId}/details`);
      const splitFuture = await normal(`budgets/${futureId}/details`);
      const parts = [
        ...splitCurrent.budgetLines,
        ...splitFuture.budgetLines,
      ].filter((line: BudgetLine) => line.name.startsWith('Matrix rent'));
      expect(parts).toHaveLength(2);
      expect(
        parts.reduce((sum, line: BudgetLine) => sum + line.amount, 0),
      ).toBe(240);
      expect(parts.some((line: BudgetLine) => line.id === rentId)).toBe(false);
      const metrics = BudgetFormulas.calculateAllMetrics(
        splitCurrent.budgetLines as BudgetLine[],
        splitCurrent.transactions as Transaction[],
        splitCurrent.budget.rollover,
      );
      const totals = `Revenus ${round(metrics.totalIncome)} · Dépenses ${round(metrics.totalExpenses)} · Épargne prévue ${round(metrics.totalSavings)} · Report ${round(metrics.rollover)} · Disponible à dépenser ${round(metrics.remaining)}`;
      const month = await call('get_month', { ...period });
      expect(month).toContain(totals);
      expect(await call('get_current_month')).toBe(month);
      expect(await call('list_months', { limit: 60 })).toContain(totals);
      expect(month).not.toContain('Isolated test expense');
      expect(
        await normal(`transactions/search?q=Matrix&years=${period.year}`),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: expenseId, amount: 35 }),
        ]),
      );
      expect(
        await call('search_movements', {
          query: 'Matrix',
          years: [period.year],
        }),
      ).toContain(expenseId);
      await call('delete_movement', { movementId: expenseId });
      const removed = await admin
        .from('transaction')
        .select('id')
        .eq('id', expenseId);
      expect(removed.data).toHaveLength(0);
      const encrypted = await admin
        .from('savings_goal')
        .select('target_amount, initial_amount')
        .eq('id', goalId)
        .single();
      expect(encrypted.data?.target_amount === '1000').toBe(false);
      expect(encrypted.data?.initial_amount === '100').toBe(false);
      expect(used.size).toBe(15);
    });

    it('searches literal punctuation and tag names consistently through MCP and ordinary REST', async () => {
      const owner = owners[1];
      const token = (
        await exchange(client, await authorize(client, owner)).expect(200)
      ).body.access_token;
      const name = 'A, b.: (c) "q" \\ %_* [x]+$';
      const ids: string[] = [];
      for (const kind of ['movement', 'forecast'] as const) {
        ids.push(
          resultId(
            await callTool(token, `add_${kind}`, {
              budgetId: owner.budgetId,
              name,
              amount: 13,
              kind: 'expense',
              ...(kind === 'forecast' ? { recurrence: 'one_off' } : {}),
            }),
          ),
        );
      }
      const tag = await request(app.getHttpServer())
        .post('/api/v1/tags')
        .auth(owner.token, { type: 'bearer' })
        .set('X-Client-Key', clientKey)
        .send({ name })
        .expect(201);
      const tagged = resultId(
        await callTool(token, 'add_movement', {
          budgetId: owner.budgetId,
          name: 'Only its tag matches',
          amount: 13,
          kind: 'expense',
        }),
      );
      ids.push(tagged);
      await request(app.getHttpServer())
        .patch(`/api/v1/transactions/${tagged}`)
        .auth(owner.token, { type: 'bearer' })
        .set('X-Client-Key', clientKey)
        .send({ tagIds: [tag.body.data.id] })
        .expect(200);
      for (const query of [
        name,
        'a, b.:',
        '"q"',
        '\\ %_*',
        '[x]+$',
        '(?i).*',
      ]) {
        const expected = query === '(?i).*' ? [] : ids;
        const rest = await request(app.getHttpServer())
          .get('/api/v1/transactions/search')
          .query({ q: query, years: 2026 })
          .auth(owner.token, { type: 'bearer' })
          .set('X-Client-Key', clientKey)
          .expect(200);
        expect(
          rest.body.data.map((row: { id: string }) => row.id).sort(),
        ).toEqual([...expected].sort());
        expect(
          rest.body.data.every((row: { amount: number }) => row.amount === 13),
        ).toBe(true);
        const found = await callTool(token, 'search_movements', {
          query,
          years: [2026],
        });
        for (const id of expected) expect(found).toContain(id);
        if (!expected.length) expect(found).toContain('Aucun résultat');
      }
      expect(
        await callTool(token, 'search_movements', {
          query: name,
          years: [2025],
        }),
      ).toContain('Aucun résultat');
    });
  },
);
