import { describe, expect, it, mock } from 'bun:test';
import type { McpTool, McpToolResult } from '../domain/mcp-tool.entity';
import type { ActiveMcpConnection } from '../domain/ports/mcp-connection-repository.port';
import type { McpActivityRepositoryPort } from '../domain/ports/mcp-activity-repository.port';
import {
  CallToolUseCase,
  McpToolNotAvailableError,
} from './call-tool.use-case';
import { ListToolsUseCase } from './list-tools.use-case';

const connection = {
  id: 'connection',
  mode: 'read_write',
} as ActiveMcpConnection;

function setup(execute: () => Promise<McpToolResult>, mode = 'read_write') {
  const tool = { name: 'add_movement', mode, execute } as unknown as McpTool;
  const record = mock(async (..._args: unknown[]) => undefined);
  const useCase = new CallToolUseCase(new ListToolsUseCase([tool]), {
    record,
  } as unknown as McpActivityRepositoryPort);
  const outcomes = () =>
    record.mock.calls.map((call) => (call[0] as { outcome: string }).outcome);
  return { useCase, outcomes };
}

describe('CallToolUseCase', () => {
  it('records a write once, as ok, and returns the tool reply', async () => {
    const { useCase, outcomes } = setup(async () => ({ text: 'Ajouté.' }));

    const result = await useCase.execute(
      connection,
      'owner',
      'add_movement',
      {},
    );

    expect(result.text).toBe('Ajouté.');
    expect(outcomes()).toEqual(['ok']);
  });

  it('records a refused write as error and rethrows the tool error', async () => {
    const refusal = new Error('refused');
    const { useCase, outcomes } = setup(async () => {
      throw refusal;
    });

    await expect(
      useCase.execute(connection, 'owner', 'add_movement', {}),
    ).rejects.toBe(refusal);
    expect(outcomes()).toEqual(['error']);
  });

  it('records nothing for a reply that changed nothing', async () => {
    const { useCase, outcomes } = setup(async () => ({
      text: 'Information manquante',
      wrote: false,
    }));

    await useCase.execute(connection, 'owner', 'add_movement', {});

    expect(outcomes()).toEqual([]);
  });

  it('records nothing for a read tool', async () => {
    const { useCase, outcomes } = setup(async () => ({ text: 'Mois' }), 'read');

    await useCase.execute(connection, 'owner', 'add_movement', {});

    expect(outcomes()).toEqual([]);
  });

  it('refuses a tool the connection does not list', async () => {
    const { useCase } = setup(async () => ({ text: '' }));

    await expect(
      useCase.execute(connection, 'owner', 'delete_tag', {}),
    ).rejects.toBeInstanceOf(McpToolNotAvailableError);
  });
});
