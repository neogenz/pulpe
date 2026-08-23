import { describe, expect, it } from 'bun:test';
import { ApproveConnectionUseCase } from './approve-connection.use-case';
import { DenyConnectionUseCase } from './deny-connection.use-case';
import type { NewMcpConnection } from '../domain/mcp-connection.entity';
import type { OAuthAuthorizationPort } from '../domain/ports/oauth-authorization.port';
import type { McpConnectionRepositoryPort } from '../domain/ports/mcp-connection-repository.port';
import type { EncryptionPort } from '@modules/encryption/encryption.tokens';

function harness(saveFails = false) {
  const calls: string[] = [];
  const saved: NewMcpConnection[] = [];
  const authorizations: OAuthAuthorizationPort = {
    getDetails: async () => {
      calls.push('details');
      return { clientId: 'client-1', clientName: 'ChatGPT' };
    },
    approve: async () => {
      calls.push('approve');
      return 'https://chatgpt.com/cb?code=c&state=s';
    },
    deny: async () => {
      calls.push('deny');
      return 'https://chatgpt.com/cb?error=access_denied&state=s';
    },
  };
  const connections = {
    findActive: async () => null,
    save: async (c: NewMcpConnection) => {
      calls.push('save');
      if (saveFails) throw new Error('db down');
      saved.push(c);
    },
  } satisfies McpConnectionRepositoryPort;
  const encryption = {
    wrapSecret: (secret: Buffer) => `wrapped:${secret.toString('hex')}`,
  } as unknown as EncryptionPort;
  return {
    calls,
    saved,
    approve: new ApproveConnectionUseCase(
      authorizations,
      connections,
      encryption,
    ),
    deny: new DenyConnectionUseCase(authorizations),
  };
}

const user = {
  id: 'user-1',
  accessToken: 'jwt',
  clientKey: Buffer.alloc(32, 7),
};

describe('consent decision', () => {
  it('approve writes the wrapped grant before telling the authorization server', async () => {
    const h = harness();
    const url = await h.approve.execute({
      authorizationId: 'auth-1',
      mode: 'read',
      user,
    });
    expect(url).toContain('code=c');
    expect(h.calls).toEqual(['details', 'save', 'approve']);
    expect(h.saved[0]).toEqual({
      userId: 'user-1',
      clientId: 'client-1',
      clientName: 'ChatGPT',
      mode: 'read',
      wrappedClientKey: `wrapped:${'07'.repeat(32)}`,
    });
  });

  it('approve never reaches the authorization server when the grant cannot be written', async () => {
    const h = harness(true);
    await expect(
      h.approve.execute({ authorizationId: 'auth-1', mode: 'read', user }),
    ).rejects.toThrow('db down');
    expect(h.calls).not.toContain('approve');
  });

  it('deny stores nothing and returns the OAuth error redirect', async () => {
    const h = harness();
    const url = await h.deny.execute('auth-1', 'jwt');
    expect(url).toContain('error=access_denied');
    expect(h.calls).toEqual(['deny']);
    expect(h.saved).toHaveLength(0);
  });
});
