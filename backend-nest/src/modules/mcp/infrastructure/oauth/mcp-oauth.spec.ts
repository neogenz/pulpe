import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import { createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { SupabaseOAuthAuthorizationAdapter } from './supabase-oauth-authorization.adapter';

const native = 'https://supabase.test/auth/v1';
const callback = 'https://api.pulpe.test/mcp/oauth/upstream-callback';
const json = (value: unknown) => Response.json(value);
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>;
afterEach(() => fetchSpy?.mockRestore());

function upstream(
  options: {
    cached?: boolean;
    wrongState?: boolean;
    owner?: string;
    redirectToken?: boolean;
  } = {},
) {
  let authorize: URL | undefined;
  const requests: string[] = [];
  const adapter = new SupabaseOAuthAuthorizationAdapter(
    new ConfigService({
      SUPABASE_URL: 'https://supabase.test',
      SUPABASE_ANON_KEY: 'test-anon',
      MCP_RESOURCE_URL: 'https://api.pulpe.test/mcp',
      MCP_UPSTREAM_CLIENT_ID: 'private-client',
      MCP_UPSTREAM_CLIENT_SECRET: 'test-secret',
    }),
  );
  const approval = () => ({
    redirect_url: `${callback}?${new URLSearchParams({
      code: 'private-code',
      state: options.wrongState
        ? 'another-flow'
        : authorize!.searchParams.get('state')!,
    })}`,
  });
  fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    const url = new URL(String(input));
    requests.push(url.pathname);
    expect(url.origin).toBe('https://supabase.test');
    expect(init?.redirect).toBe('manual');
    if (url.href.startsWith(`${native}/oauth/authorize?`)) {
      authorize = url;
      expect(url.searchParams.get('redirect_uri')).toBe(callback);
      expect(url.searchParams.get('client_id')).toBe('private-client');
      expect(new Headers(init?.headers).has('authorization')).toBe(false);
      return new Response(null, {
        status: 302,
        headers: {
          location:
            'https://app.pulpe.test/mcp-consent?authorization_id=native-id',
        },
      });
    }
    if (url.pathname === '/auth/v1/oauth/authorizations/native-id') {
      return json(
        options.cached
          ? approval()
          : { client: { id: 'private-client', name: 'Internal Pulpe' } },
      );
    }
    if (url.pathname.endsWith('/consent')) return json(approval());
    if (url.pathname === '/auth/v1/oauth/token') {
      const body = new URLSearchParams(String(init?.body));
      expect(body.get('client_id')).toBe('private-client');
      expect(body.get('client_secret')).toBe('test-secret');
      if (body.get('grant_type') === 'authorization_code') {
        expect(body.get('code')).toBe('private-code');
        expect(
          createHash('sha256')
            .update(body.get('code_verifier')!)
            .digest('base64url'),
        ).toBe(authorize!.searchParams.get('code_challenge')!);
      } else {
        expect(body.get('grant_type')).toBe('refresh_token');
        expect(body.get('refresh_token')).toBe('private-refresh');
      }
      return options.redirectToken
        ? new Response(null, {
            status: 302,
            headers: { location: 'https://attacker.test' },
          })
        : json({
            access_token: 'private-access',
            refresh_token: 'private-refresh',
            expires_in: 3600,
          });
    }
    if (url.pathname === '/auth/v1/user') {
      expect(new Headers(init?.headers).get('authorization')).toBe(
        'Bearer private-access',
      );
      return json({ id: options.owner ?? 'owner-1' });
    }
    throw new Error('Unexpected native request');
  }) as typeof fetch);
  return { adapter, requests };
}

describe('MCP confidential upstream session', () => {
  it.each([false, true])(
    'keeps PKCE, code and session backend-only (cached native grant: %s)',
    async (cached) => {
      const { adapter, requests } = upstream({ cached });
      const session = await adapter.createPrivateSession(
        'first-party-access',
        'owner-1',
      );
      expect(session.accessToken).toBe('private-access');
      expect(session.refreshToken).toBe('private-refresh');
      expect(session.expiresAt).toBeGreaterThan(Date.now() / 1000 + 3500);
      expect(
        requests.includes('/auth/v1/oauth/authorizations/native-id/consent'),
      ).toBe(!cached);
    },
  );

  it('rejects a callback from another flow before exchanging its code', async () => {
    const { adapter, requests } = upstream({ wrongState: true });
    await expect(
      adapter.createPrivateSession('first-party-access', 'owner-1'),
    ).rejects.toThrow();
    expect(requests).not.toContain('/auth/v1/oauth/token');
  });

  it('rejects a session belonging to another owner', async () => {
    const { adapter } = upstream({ owner: 'owner-2' });
    await expect(
      adapter.createPrivateSession('first-party-access', 'owner-1'),
    ).rejects.toThrow();
  });

  it('refreshes the private session using the confidential client credentials', async () => {
    const { adapter, requests } = upstream();
    expect(
      (await adapter.refreshPrivateSession('private-refresh', 'owner-1'))
        .accessToken,
    ).toBe('private-access');
    expect(requests).toEqual(['/auth/v1/oauth/token', '/auth/v1/user']);
  });

  it('does not follow a token endpoint redirect carrying client credentials', async () => {
    const { adapter, requests } = upstream({ redirectToken: true });
    await expect(
      adapter.refreshPrivateSession('private-refresh', 'owner-1'),
    ).rejects.toThrow();
    expect(requests).toEqual(['/auth/v1/oauth/token']);
  });

  it('does not extend the private token lifetime by the owner lookup latency', async () => {
    const { adapter } = upstream();
    const now = spyOn(Date, 'now')
      .mockReturnValueOnce(1_000)
      .mockReturnValue(30_000);
    try {
      const session = await adapter.refreshPrivateSession(
        'private-refresh',
        'owner-1',
      );
      expect(session.expiresAt).toBe(3_601);
    } finally {
      now.mockRestore();
    }
  });
});
