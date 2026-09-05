import { describe, expect, it } from 'bun:test';
import { ApproveConnectionUseCase } from './approve-connection.use-case';
import { DenyConnectionUseCase } from './deny-connection.use-case';
import type { NewMcpConnection } from '../domain/mcp-connection.entity';
import type { OAuthAuthorizationPort } from '../domain/ports/oauth-authorization.port';
import type { EncryptionPort } from '@modules/encryption/encryption.tokens';

function harness(saveFails = false) {
  const calls: string[] = [];
  const saved: NewMcpConnection[] = [];
  const authorizations: OAuthAuthorizationPort = {
    getDetails: async () => {
      calls.push('details');
      return { clientId: 'client-1', clientName: 'ChatGPT' };
    },
    approve: async (_id, _token, grant) => {
      calls.push('approve');
      if (saveFails) throw new Error('db down');
      saved.push(grant);
      return 'https://chatgpt.com/cb?code=c&state=s';
    },
    deny: async () => {
      calls.push('deny');
      return 'https://chatgpt.com/cb?error=access_denied&state=s';
    },
    revokeGrant: async () => {},
  };
  const encryption = {
    wrapSecret: (secret: Buffer) => `wrapped:${secret.toString('hex')}`,
  } as unknown as EncryptionPort;
  return {
    calls,
    saved,
    approve: new ApproveConnectionUseCase(authorizations, encryption),
    deny: new DenyConnectionUseCase(authorizations),
  };
}

const user = {
  id: 'user-1',
  accessToken: 'jwt',
  clientKey: Buffer.alloc(32, 7),
};

describe('consent decision', () => {
  it('approve passes the verified owner, selected mode and wrapped key to the atomic issuer', async () => {
    const h = harness();
    const url = await h.approve.execute({
      authorizationId: 'auth-1',
      mode: 'read',
      user,
    });
    expect(url).toContain('code=c');
    expect(h.calls).toEqual(['details', 'approve']);
    expect(h.saved[0]).toEqual({
      userId: 'user-1',
      clientId: 'client-1',
      clientName: 'ChatGPT',
      mode: 'read',
      wrappedClientKey: `wrapped:${'07'.repeat(32)}`,
    });
  });

  it('approve returns no redirect when the issuer cannot persist the grant', async () => {
    const h = harness(true);
    await expect(
      h.approve.execute({ authorizationId: 'auth-1', mode: 'read', user }),
    ).rejects.toThrow('db down');
    expect(h.saved).toHaveLength(0);
  });

  it('deny stores nothing and returns the OAuth error redirect', async () => {
    const h = harness();
    const url = await h.deny.execute('auth-1', 'jwt');
    expect(url).toContain('error=access_denied');
    expect(h.calls).toEqual(['deny']);
    expect(h.saved).toHaveLength(0);
  });
});
