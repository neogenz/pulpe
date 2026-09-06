import { describe, expect, it, mock } from 'bun:test';
import { Test } from '@nestjs/testing';
import { SupabaseService } from '@modules/supabase/supabase.service';
import { SupabaseMcpActivityRepository } from './supabase-mcp-activity.repository';

describe('MCP activity recording', () => {
  it.each([false, true])(
    'never turns an executed write into a retryable failure (rejection: %s)',
    async (reject) => {
      const warn = mock(() => {});
      const failure = new Error('Sensitive upstream message');
      const module = await Test.createTestingModule({
        providers: [
          SupabaseMcpActivityRepository,
          {
            provide: `INFO_LOGGER:${SupabaseMcpActivityRepository.name}`,
            useValue: { warn },
          },
          {
            provide: SupabaseService,
            useValue: {
              getServiceRoleClient: () => ({
                from: () => ({
                  insert: async () => {
                    if (reject) throw failure;
                    return { error: failure };
                  },
                }),
              }),
            },
          },
        ],
      }).compile();
      try {
        await expect(
          module.get(SupabaseMcpActivityRepository).record({
            connectionId: 'connection',
            userId: 'owner',
            tool: 'add_movement',
            outcome: 'ok',
          }),
        ).resolves.toBeUndefined();
        expect(warn).toHaveBeenCalledWith(
          { operation: 'mcpActivity.record', userId: 'owner' },
          'Agent activity could not be recorded',
        );
      } finally {
        await module.close();
      }
    },
  );
});
