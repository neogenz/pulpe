import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import { SupabaseService } from '@modules/supabase/supabase.service';
import { SupabaseAccountDeletionRepository } from './supabase-account-deletion.repository';

describe('SupabaseAccountDeletionRepository', () => {
  let repo: SupabaseAccountDeletionRepository;
  let supabaseService: SupabaseService;
  let mockLogger: {
    info: ReturnType<typeof mock>;
    warn: ReturnType<typeof mock>;
  };

  beforeEach(async () => {
    mockLogger = { info: mock(() => {}), warn: mock(() => {}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseAccountDeletionRepository,
        {
          provide: SupabaseService,
          useValue: {
            getServiceRoleClient: mock() as ReturnType<typeof mock>,
          },
        },
        {
          provide: `INFO_LOGGER:${SupabaseAccountDeletionRepository.name}`,
          useValue: mockLogger,
        },
      ],
    }).compile();

    repo = module.get(SupabaseAccountDeletionRepository);
    supabaseService = module.get(SupabaseService);
  });

  describe('listExpiredScheduledUsers', () => {
    it('returns only users whose grace period has expired', async () => {
      const now = new Date();
      const fourDaysAgo = new Date(
        now.getTime() - 4 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const oneDayAgo = new Date(
        now.getTime() - 1 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const mockUsers = [
        { id: 'expired', user_metadata: { scheduledDeletionAt: fourDaysAgo } },
        {
          id: 'within-grace',
          user_metadata: { scheduledDeletionAt: oneDayAgo },
        },
        { id: 'no-metadata', user_metadata: {} },
      ];

      const adminClient = {
        auth: {
          admin: {
            listUsers: mock(() =>
              Promise.resolve({ data: { users: mockUsers }, error: null }),
            ),
          },
        },
      };

      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => adminClient,
      );

      const result = await repo.listExpiredScheduledUsers(now);

      expect(result.map((u) => u.id)).toEqual(['expired']);
    });

    it('warns and skips users with invalid scheduledDeletionAt strings', async () => {
      const now = new Date();
      const adminClient = {
        auth: {
          admin: {
            listUsers: mock(() =>
              Promise.resolve({
                data: {
                  users: [
                    {
                      id: 'bad-date',
                      user_metadata: { scheduledDeletionAt: 'not-a-date' },
                    },
                  ],
                },
                error: null,
              }),
            ),
          },
        },
      };

      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => adminClient,
      );

      const result = await repo.listExpiredScheduledUsers(now);

      expect(result).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('stops paginating when listUsers returns an error', async () => {
      const now = new Date();
      const adminClient = {
        auth: {
          admin: {
            listUsers: mock(() =>
              Promise.resolve({
                data: null,
                error: new Error('Auth API down'),
              }),
            ),
          },
        },
      };

      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => adminClient,
      );

      const result = await repo.listExpiredScheduledUsers(now);

      expect(result).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('deleteUser', () => {
    it('throws when admin.deleteUser returns an error', async () => {
      const adminClient = {
        auth: {
          admin: {
            deleteUser: mock(() =>
              Promise.resolve({ error: new Error('boom') }),
            ),
          },
        },
      };

      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => adminClient,
      );

      await expect(repo.deleteUser('user-1')).rejects.toThrow('boom');
    });

    it('resolves when admin.deleteUser succeeds', async () => {
      const adminClient = {
        auth: {
          admin: {
            deleteUser: mock(() => Promise.resolve({ error: null })),
          },
        },
      };

      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => adminClient,
      );

      await expect(repo.deleteUser('user-1')).resolves.toBeUndefined();
    });
  });
});
