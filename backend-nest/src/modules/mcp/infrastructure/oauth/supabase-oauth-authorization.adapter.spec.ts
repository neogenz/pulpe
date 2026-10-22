import { describe, expect, it } from 'bun:test';
import type { ConfigService } from '@nestjs/config';
import type { SupabaseMcpOAuthRepository } from '../persistence/supabase-mcp-oauth.repository';
import { SupabaseOAuthAuthorizationAdapter } from './supabase-oauth-authorization.adapter';

function adapterFor(redirectUri: string) {
  const config = {
    getOrThrow: () => 'http://supabase.test',
  } as unknown as ConfigService;
  const store = {
    pending: async () => ({
      client_id: 'c',
      redirect_uri: redirectUri,
      state: null,
    }),
    getClient: async () => ({ client_id: 'c', client_name: 'Claude' }),
  } as unknown as SupabaseMcpOAuthRepository;
  return new SupabaseOAuthAuthorizationAdapter(config, store);
}

describe('SupabaseOAuthAuthorizationAdapter.getDetails', () => {
  it('returns the declared name with the host of the stored redirect URI, not its path, port or query', async () => {
    const details = await adapterFor(
      'https://attacker.example:8443/cb?x=1',
    ).getDetails('auth-1', 'jwt');

    expect(details).toEqual({
      clientId: 'c',
      clientName: 'Claude',
      redirectHost: 'attacker.example',
    });
  });

  // The consent page matches these exact strings to word a loopback callback.
  it('returns a loopback host as the consent page expects it, IPv6 in brackets', async () => {
    for (const [uri, host] of [
      ['http://localhost:3000/cb', 'localhost'],
      ['http://127.0.0.1:53682/cb', '127.0.0.1'],
      ['http://[::1]:8080/cb', '[::1]'],
    ]) {
      const details = await adapterFor(uri).getDetails('auth-1', 'jwt');
      expect(details.redirectHost).toBe(host);
    }
  });

  it('returns a look-alike internationalized host in its punycode form', async () => {
    const details = await adapterFor('https://clаude.ai/cb').getDetails(
      'auth-1',
      'jwt',
    );

    // Cyrillic "а", not the latin one: it must not read as claude.ai.
    expect(details.redirectHost).toBe('xn--clude-5ve.ai');
    expect(details.redirectHost).not.toBe('claude.ai');
  });
});
