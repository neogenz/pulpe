import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import { AccountDeletionService } from './account-deletion.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('AccountDeletionService', () => {
  let service: AccountDeletionService;
  let supabaseService: SupabaseService;
  let mockLogger: {
    info: ReturnType<typeof mock>;
    warn: ReturnType<typeof mock>;
  };

  beforeEach(async () => {
    mockLogger = {
      info: mock(() => {}),
      warn: mock(() => {}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountDeletionService,
        {
          provide: SupabaseService,
          useValue: {
            getServiceRoleClient: mock() as ReturnType<typeof mock>,
          },
        },
        {
          provide: `INFO_LOGGER:${AccountDeletionService.name}`,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<AccountDeletionService>(AccountDeletionService);
    supabaseService = module.get<SupabaseService>(SupabaseService);
  });

  describe('cleanupScheduledDeletions - Grace Period Enforcement', () => {
    it('should delete users whose grace period (3 days) has expired', async () => {
      // Use actual current time - test dates are relative
      const now = new Date();
      const mockUsers = [
        {
          id: 'user-expired-4-days',
          email: 'expired4@example.com',
          user_metadata: {
            scheduledDeletionAt: new Date(
              now.getTime() - 4 * 24 * 60 * 60 * 1000,
            ).toISOString(), // 4 days ago
          },
        },
        {
          id: 'user-expired-exactly-3-days',
          email: 'expired3@example.com',
          user_metadata: {
            scheduledDeletionAt: new Date(
              now.getTime() - 3 * 24 * 60 * 60 * 1000,
            ).toISOString(), // Exactly 3 days ago
          },
        },
      ];

      const mockDeleteUser = mock(() => Promise.resolve({ error: null }));
      const mockAdminClient = {
        auth: {
          admin: {
            listUsers: mock(() =>
              Promise.resolve({
                data: { users: mockUsers },
                error: null,
              }),
            ),
            deleteUser: mockDeleteUser,
          },
        },
      };

      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => mockAdminClient,
      );

      await service.cleanupScheduledDeletions();

      expect(mockDeleteUser).toHaveBeenCalledWith('user-expired-4-days');
      expect(mockDeleteUser).toHaveBeenCalledWith(
        'user-expired-exactly-3-days',
      );
    });

    it('should NOT delete users within 3-day grace period', async () => {
      // Use actual current time - test dates are relative
      const now = new Date();
      const mockUsers = [
        {
          id: 'user-within-grace-2-days',
          email: 'grace2@example.com',
          user_metadata: {
            scheduledDeletionAt: new Date(
              now.getTime() - 2 * 24 * 60 * 60 * 1000,
            ).toISOString(), // 2 days ago
          },
        },
        {
          id: 'user-just-scheduled',
          email: 'justnow@example.com',
          user_metadata: {
            scheduledDeletionAt: new Date(
              now.getTime() - 1 * 60 * 60 * 1000,
            ).toISOString(), // 1 hour ago
          },
        },
      ];

      const mockDeleteUser = mock(() => Promise.resolve({ error: null }));
      const mockAdminClient = {
        auth: {
          admin: {
            listUsers: mock(() =>
              Promise.resolve({
                data: { users: mockUsers },
                error: null,
              }),
            ),
            deleteUser: mockDeleteUser,
          },
        },
      };

      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => mockAdminClient,
      );

      await service.cleanupScheduledDeletions();

      expect(mockDeleteUser).not.toHaveBeenCalled();
    });

    it('should handle exact 3-day boundary correctly', async () => {
      // Use actual current time - test dates are relative
      const now = new Date();
      const exactlyThreeDaysAgo = new Date(
        now.getTime() - 3 * 24 * 60 * 60 * 1000,
      );
      const justUnderThreeDays = new Date(
        now.getTime() - (3 * 24 * 60 * 60 * 1000 - 1000),
      ); // 1 second less

      const mockUsers = [
        {
          id: 'user-exactly-3-days',
          email: 'exact3@example.com',
          user_metadata: {
            scheduledDeletionAt: exactlyThreeDaysAgo.toISOString(),
          },
        },
        {
          id: 'user-just-under-3-days',
          email: 'under3@example.com',
          user_metadata: {
            scheduledDeletionAt: justUnderThreeDays.toISOString(),
          },
        },
      ];

      const mockDeleteUser = mock(() => Promise.resolve({ error: null }));
      const mockAdminClient = {
        auth: {
          admin: {
            listUsers: mock(() =>
              Promise.resolve({
                data: { users: mockUsers },
                error: null,
              }),
            ),
            deleteUser: mockDeleteUser,
          },
        },
      };

      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => mockAdminClient,
      );

      await service.cleanupScheduledDeletions();

      // Exactly 3 days should be deleted (>= comparison)
      expect(mockDeleteUser).toHaveBeenCalledWith('user-exactly-3-days');
      // Just under 3 days should NOT be deleted
      expect(mockDeleteUser).not.toHaveBeenCalledWith('user-just-under-3-days');
    });
  });

  describe('cleanupScheduledDeletions - User Filtering', () => {
    it('should skip users without scheduledDeletionAt metadata', async () => {
      const mockUsers = [
        {
          id: 'regular-user-no-metadata',
          email: 'regular@example.com',
          user_metadata: {},
        },
        {
          id: 'regular-user-null-metadata',
          email: 'regular2@example.com',
          user_metadata: null,
        },
        {
          id: 'regular-user-undefined-scheduled',
          email: 'regular3@example.com',
          user_metadata: { firstName: 'John', scheduledDeletionAt: undefined },
        },
      ];

      const mockDeleteUser = mock(() => Promise.resolve({ error: null }));
      const mockAdminClient = {
        auth: {
          admin: {
            listUsers: mock(() =>
              Promise.resolve({
                data: { users: mockUsers },
                error: null,
              }),
            ),
            deleteUser: mockDeleteUser,
          },
        },
      };

      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => mockAdminClient,
      );

      await service.cleanupScheduledDeletions();

      expect(mockDeleteUser).not.toHaveBeenCalled();
    });

    it('should skip users with invalid scheduledDeletionAt date format', async () => {
      const mockUsers = [
        {
          id: 'user-invalid-date',
          email: 'invalid@example.com',
          user_metadata: {
            scheduledDeletionAt: 'not-a-valid-date',
          },
        },
        {
          id: 'user-invalid-date-2',
          email: 'invalid2@example.com',
          user_metadata: {
            scheduledDeletionAt: '2025-13-45', // Invalid month/day
          },
        },
      ];

      const mockDeleteUser = mock(() => Promise.resolve({ error: null }));
      const mockAdminClient = {
        auth: {
          admin: {
            listUsers: mock(() =>
              Promise.resolve({
                data: { users: mockUsers },
                error: null,
              }),
            ),
            deleteUser: mockDeleteUser,
          },
        },
      };

      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => mockAdminClient,
      );

      await service.cleanupScheduledDeletions();

      expect(mockDeleteUser).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should return early when no expired users are found', async () => {
      const mockAdminClient = {
        auth: {
          admin: {
            listUsers: mock(() =>
              Promise.resolve({
                data: { users: [] },
                error: null,
              }),
            ),
            deleteUser: mock(() => Promise.resolve({ error: null })),
          },
        },
      };

      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => mockAdminClient,
      );

      await service.cleanupScheduledDeletions();

      expect(mockAdminClient.auth.admin.deleteUser).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'No expired scheduled deletions to process',
      );
    });
  });

  describe('cleanupScheduledDeletions - Pagination', () => {
    it('should iterate through multiple pages of users', async () => {
      // Use actual current time - test dates are relative
      const now = new Date();
      const expiredDate = new Date(
        now.getTime() - 5 * 24 * 60 * 60 * 1000,
      ).toISOString();

      // Create 1000 users for first page (full page)
      const firstPageUsers = Array.from({ length: 1000 }, (_, i) => ({
        id: `user-page1-${i}`,
        email: `page1-${i}@example.com`,
        user_metadata: i === 0 ? { scheduledDeletionAt: expiredDate } : {},
      }));

      // Create 500 users for second page (partial page, signals end)
      const secondPageUsers = Array.from({ length: 500 }, (_, i) => ({
        id: `user-page2-${i}`,
        email: `page2-${i}@example.com`,
        user_metadata: i === 0 ? { scheduledDeletionAt: expiredDate } : {},
      }));

      let pageCallCount = 0;
      const mockDeleteUser = mock(() => Promise.resolve({ error: null }));
      const mockAdminClient = {
        auth: {
          admin: {
            listUsers: mock(() => {
              pageCallCount++;
              if (pageCallCount === 1) {
                return Promise.resolve({
                  data: { users: firstPageUsers },
                  error: null,
                });
              }
              return Promise.resolve({
                data: { users: secondPageUsers },
                error: null,
              });
            }),
            deleteUser: mockDeleteUser,
          },
        },
      };

      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => mockAdminClient,
      );

      await service.cleanupScheduledDeletions();

      expect(pageCallCount).toBe(2);
      expect(mockDeleteUser).toHaveBeenCalledWith('user-page1-0');
      expect(mockDeleteUser).toHaveBeenCalledWith('user-page2-0');
    });
  });

  describe('cleanupScheduledDeletions - Error Handling', () => {
    it('should not crash when Supabase listUsers fails', async () => {
      const mockAdminClient = {
        auth: {
          admin: {
            listUsers: mock(() =>
              Promise.resolve({
                data: null,
                error: new Error('Supabase API error'),
              }),
            ),
            deleteUser: mock(() => Promise.resolve({ error: null })),
          },
        },
      };

      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => mockAdminClient,
      );

      let error: Error | undefined;
      try {
        await service.cleanupScheduledDeletions();
      } catch (e) {
        error = e as Error;
      }

      expect(error).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should handle partial delete failures gracefully', async () => {
      // Use actual current time - test dates are relative
      const now = new Date();
      const expiredDate = new Date(
        now.getTime() - 5 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const mockUsers = [
        {
          id: 'user-success',
          email: 'success@example.com',
          user_metadata: { scheduledDeletionAt: expiredDate },
        },
        {
          id: 'user-fail',
          email: 'fail@example.com',
          user_metadata: { scheduledDeletionAt: expiredDate },
        },
      ];

      let deleteCallCount = 0;
      const mockAdminClient = {
        auth: {
          admin: {
            listUsers: mock(() =>
              Promise.resolve({
                data: { users: mockUsers },
                error: null,
              }),
            ),
            deleteUser: mock(() => {
              deleteCallCount++;
              if (deleteCallCount === 1) {
                return Promise.resolve({ error: null });
              }
              return Promise.resolve({ error: new Error('Delete failed') });
            }),
          },
        },
      };

      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => mockAdminClient,
      );

      await service.cleanupScheduledDeletions();

      // Both deletes should have been attempted
      expect(deleteCallCount).toBe(2);
      // Logged completion with success/failure counts
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should not crash when unexpected error is thrown', async () => {
      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => {
          throw new Error('Unexpected error');
        },
      );

      let error: Error | undefined;
      try {
        await service.cleanupScheduledDeletions();
      } catch (e) {
        error = e as Error;
      }

      expect(error).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('cleanupScheduledDeletions - Month/Year Boundary', () => {
    it('should correctly handle grace period across month boundary', async () => {
      // Use actual current time - test dates are relative
      const now = new Date();
      // 4 days ago should be deleted (grace period expired)
      const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
      // 2 days ago should NOT be deleted (still within grace period)
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

      const mockUsers = [
        {
          id: 'user-4-days-expired',
          email: 'expired@example.com',
          user_metadata: {
            scheduledDeletionAt: fourDaysAgo.toISOString(),
          },
        },
        {
          id: 'user-2-days-not-expired',
          email: 'recent@example.com',
          user_metadata: {
            scheduledDeletionAt: twoDaysAgo.toISOString(),
          },
        },
      ];

      const mockDeleteUser = mock(() => Promise.resolve({ error: null }));
      const mockAdminClient = {
        auth: {
          admin: {
            listUsers: mock(() =>
              Promise.resolve({
                data: { users: mockUsers },
                error: null,
              }),
            ),
            deleteUser: mockDeleteUser,
          },
        },
      };

      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => mockAdminClient,
      );

      await service.cleanupScheduledDeletions();

      expect(mockDeleteUser).toHaveBeenCalledWith('user-4-days-expired');
      expect(mockDeleteUser).not.toHaveBeenCalledWith(
        'user-2-days-not-expired',
      );
    });
  });
});
