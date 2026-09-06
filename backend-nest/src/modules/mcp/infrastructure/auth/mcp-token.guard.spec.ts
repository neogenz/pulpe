import { describe, expect, it } from 'bun:test';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { ClsService } from 'nestjs-cls';
import { SupabaseService } from '@modules/supabase/supabase.service';
import { ENCRYPTION_PORT } from '@modules/encryption/encryption.tokens';
import { MCP_CONNECTION_REPOSITORY } from '../../mcp.tokens';
import { ProtectedResourceMetadataController } from '../http/protected-resource-metadata.controller';
import {
  McpTokenGuard,
  decodeJwtClaims,
  isAgentToken,
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
  it.each([
    [RESOURCE, true],
    ['https://API.PULPE.APP:443/mcp', true],
    ['https://api.pulpe.app/other', false],
    ['https://other.example/mcp', false],
  ] as const)(
    'compares canonical resource URLs without widening the audience: %s',
    async (resource, accepted) => {
      const config = new ConfigService({
        MCP_RESOURCE_URL: 'https://API.PULPE.APP:443/mcp',
        MCP_UPSTREAM_CLIENT_ID: 'private-client',
      });
      const module = await Test.createTestingModule({
        providers: [
          McpTokenGuard,
          { provide: ConfigService, useValue: config },
          {
            provide: `INFO_LOGGER:${McpTokenGuard.name}`,
            useValue: { warn: () => {} },
          },
          { provide: ClsService, useValue: { isActive: () => false } },
          {
            provide: SupabaseService,
            useValue: {
              createAuthenticatedClient: () => ({
                auth: {
                  getUser: async () => ({
                    data: {
                      user: { id: 'owner', email: 'owner@test.invalid' },
                    },
                    error: null,
                  }),
                },
              }),
            },
          },
          {
            provide: ENCRYPTION_PORT,
            useValue: { ensureUserDEK: async () => {} },
          },
          {
            provide: MCP_CONNECTION_REPOSITORY,
            useValue: {
              findActive: async () => ({ clientKey: Buffer.alloc(32) }),
            },
          },
        ],
      }).compile();
      try {
        const context = new ExecutionContextHost([
          {
            auth: {
              resource: new URL(resource),
              clientId: 'pulpe_client',
              extra: {
                userId: 'owner',
                generation: 'generation',
                upstreamAccessToken: 'private-token',
              },
            },
          },
          { setHeader: () => {} },
        ]);
        const decision = module.get(McpTokenGuard).canActivate(context);
        if (accepted) await expect(decision).resolves.toBe(true);
        else await expect(decision).rejects.toThrow('Unauthorized');
        expect(
          new ProtectedResourceMetadataController(config).root().resource,
        ).toBe(RESOURCE);
      } finally {
        await module.close();
      }
    },
  );

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
  const recorded: string[] = [];
  const call = new CallToolUseCase(list, {
    record: async (a) => {
      recorded.push(`${a.tool}:${a.outcome}`);
    },
    listByConnection: async () => [],
    purgeOlderThan: async () => {},
  });
  const conn = (mode: 'read' | 'read_write') => ({
    id: 'conn-1',
    clientId: 'c',
    mode,
    clientKey: Buffer.alloc(32),
  });

  it('hides write tools from a read connection and refuses direct calls', async () => {
    expect(list.execute('read').map((t) => t.name)).toEqual(['r']);
    expect(list.execute('read_write').map((t) => t.name)).toEqual(['r', 'w']);
    expect(call.execute(conn('read'), 'u', 'w', {})).rejects.toBeInstanceOf(
      McpToolNotAvailableError,
    );
    expect((await call.execute(conn('read_write'), 'u', 'w', {})).text).toBe(
      'w',
    );
  });

  it('logs write tool calls only, with their outcome and nothing else', async () => {
    recorded.length = 0;
    await call.execute(conn('read_write'), 'u', 'r', {});
    await call.execute(conn('read_write'), 'u', 'w', { amount: 1234.56 });
    expect(recorded).toEqual(['w:ok']);
  });
});
