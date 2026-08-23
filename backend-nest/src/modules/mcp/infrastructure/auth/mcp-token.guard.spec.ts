import { describe, expect, it } from 'bun:test';
import {
  decodeJwtClaims,
  isAgentToken,
  isMcpAudience,
  protectedResourceMetadataUrl,
} from './mcp-token.guard';
import { ListToolsUseCase } from '../../application/list-tools.use-case';
import {
  CallToolUseCase,
  McpToolNotAvailableError,
} from '../../application/call-tool.use-case';
import type { McpTool } from '../../domain/mcp-tool.entity';

const RESOURCE = 'https://api.pulpe.app/mcp';

function token(claims: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256' })}.${b64(claims)}.sig`;
}

describe('MCP token claims', () => {
  it('accepts an agent token whose audiences are Supabase default or the server', () => {
    expect(
      isMcpAudience({ client_id: 'c', aud: 'authenticated' }, RESOURCE),
    ).toBe(true);
    expect(
      isMcpAudience(
        { client_id: 'c', aud: ['authenticated', RESOURCE] },
        RESOURCE,
      ),
    ).toBe(true);
  });

  it('rejects a token for another service or without client_id', () => {
    expect(
      isMcpAudience({ client_id: 'c', aud: 'https://other.example' }, RESOURCE),
    ).toBe(false);
    expect(isMcpAudience({ aud: 'authenticated' }, RESOURCE)).toBe(false);
    expect(
      isMcpAudience({ client_id: '', aud: 'authenticated' }, RESOURCE),
    ).toBe(false);
  });

  it('flags agent tokens so the REST API refuses them', () => {
    expect(isAgentToken(token({ client_id: 'c' }))).toBe(true);
    expect(isAgentToken(token({ sub: 'u' }))).toBe(false);
    expect(isAgentToken('not-a-jwt')).toBe(false);
    expect(decodeJwtClaims('a.%%%.c')).toBeNull();
  });

  it('derives the RFC 9728 metadata URL from the resource URL', () => {
    expect(protectedResourceMetadataUrl(RESOURCE)).toBe(
      'https://api.pulpe.app/.well-known/oauth-protected-resource/mcp',
    );
  });
});

describe('tool catalog by access mode', () => {
  const tool = (name: string, mode: 'read' | 'read_write'): McpTool => ({
    name,
    title: name,
    description: name,
    mode,
    annotations: {
      readOnlyHint: mode === 'read',
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {},
    execute: async () => ({ text: name }),
  });
  const list = new ListToolsUseCase([
    tool('r', 'read'),
    tool('w', 'read_write'),
  ]);
  const call = new CallToolUseCase(list);

  it('hides write tools from a read connection and refuses direct calls', async () => {
    expect(list.execute('read').map((t) => t.name)).toEqual(['r']);
    expect(list.execute('read_write').map((t) => t.name)).toEqual(['r', 'w']);
    expect(call.execute('read', 'w', {})).rejects.toBeInstanceOf(
      McpToolNotAvailableError,
    );
    expect((await call.execute('read_write', 'w', {})).text).toBe('w');
  });
});
