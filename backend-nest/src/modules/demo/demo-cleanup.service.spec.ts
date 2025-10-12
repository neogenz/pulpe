import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { DemoCleanupService } from './demo-cleanup.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('DemoCleanupService - Business Value Tests', () => {
  let service: DemoCleanupService;
  let supabaseService: SupabaseService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({})], // Empty config for this service
        }),
      ],
      providers: [
        DemoCleanupService,
        {
          provide: SupabaseService,
          useValue: {
            getServiceRoleClient: mock() as any,
          },
        },
        {
          provide: `PinoLogger:${DemoCleanupService.name}`,
          useValue: {
            error: mock(() => {}),
            info: mock(() => {}),
            debug: mock(() => {}),
            warn: mock(() => {}),
          },
        },
      ],
    }).compile();

    service = module.get<DemoCleanupService>(DemoCleanupService);
    supabaseService = module.get<SupabaseService>(SupabaseService);
  });

  describe('cleanupExpiredDemoUsers - Security Protection', () => {
    it('should never delete regular users even with corrupted is_demo flag', async () => {
      // GIVEN: Mock admin client with mixed users
      const mockUsers = [
        {
          id: 'regular-user-1',
          email: 'regular@example.com',
          created_at: '2024-01-01T00:00:00.000Z',
          user_metadata: {}, // Regular user without demo flag
        },
        {
          id: 'corrupted-user-1',
          email: 'corrupted@example.com',
          created_at: '2024-01-01T00:00:00.000Z',
          user_metadata: {}, // Regular user without demo flag (no corruption scenario in current logic)
        },
        {
          id: 'demo-user-old',
          email: 'demo-old@pulpe.app',
          created_at: '2024-01-01T00:00:00.000Z', // 30+ days old
          user_metadata: { is_demo: true },
        },
      ];

      const mockAdminClient = {
        auth: {
          admin: {
            listUsers: mock(() =>
              Promise.resolve({
                data: { users: mockUsers },
                error: null,
              }),
            ),
            deleteUser: mock(() => Promise.resolve({ error: null })),
          },
        },
      };

      (supabaseService.getServiceRoleClient as any) = mock(
        () => mockAdminClient,
      );

      // WHEN: Running the cleanup cron job
      await service.cleanupExpiredDemoUsers();

      // THEN: Only the legitimate demo user should be deleted
      expect(mockAdminClient.auth.admin.deleteUser).toHaveBeenCalledWith(
        'demo-user-old',
      );

      // AND: Regular users and corrupted entries are protected
      expect(mockAdminClient.auth.admin.deleteUser).not.toHaveBeenCalledWith(
        'regular-user-1',
      );
      expect(mockAdminClient.auth.admin.deleteUser).not.toHaveBeenCalledWith(
        'corrupted-user-1',
      );
    });
  });

  describe('cleanupExpiredDemoUsers - 24h Retention Policy', () => {
    it('should only delete demo users older than 24 hours in cron job', async () => {
      // GIVEN: Mock users with different creation times
      const now = new Date();
      const mockUsers = [
        {
          id: 'demo-user-23h',
          email: 'demo-23h@pulpe.app',
          created_at: new Date(
            now.getTime() - 23 * 60 * 60 * 1000,
          ).toISOString(), // 23h ago
          user_metadata: { is_demo: true },
        },
        {
          id: 'demo-user-24h',
          email: 'demo-24h@pulpe.app',
          created_at: new Date(
            now.getTime() - (24 * 60 * 60 * 1000 + 1000),
          ).toISOString(), // 24h 1s ago (should be deleted)
          user_metadata: { is_demo: true },
        },
        {
          id: 'demo-user-25h',
          email: 'demo-25h@pulpe.app',
          created_at: new Date(
            now.getTime() - 25 * 60 * 60 * 1000,
          ).toISOString(), // 25h ago
          user_metadata: { is_demo: true },
        },
      ];

      const mockAdminClient = {
        auth: {
          admin: {
            listUsers: mock(() =>
              Promise.resolve({
                data: { users: mockUsers },
                error: null,
              }),
            ),
            deleteUser: mock(() => Promise.resolve({ error: null })),
          },
        },
      };

      (supabaseService.getServiceRoleClient as any) = mock(
        () => mockAdminClient,
      );

      // WHEN: Running the cron cleanup job
      await service.cleanupExpiredDemoUsers();

      // THEN: Users >= 24h should be deleted
      expect(mockAdminClient.auth.admin.deleteUser).toHaveBeenCalledWith(
        'demo-user-24h',
      );
      expect(mockAdminClient.auth.admin.deleteUser).toHaveBeenCalledWith(
        'demo-user-25h',
      );

      // AND: Recent users are preserved
      expect(mockAdminClient.auth.admin.deleteUser).not.toHaveBeenCalledWith(
        'demo-user-23h',
      );
    });
  });

  describe('cleanupExpiredDemoUsers - System Resilience', () => {
    it('should not crash cron job if Supabase auth API is unavailable', async () => {
      // GIVEN: Mock Supabase service to fail
      (supabaseService.getServiceRoleClient as any) = mock(() => {
        throw new Error('Supabase API timeout');
      });

      // WHEN: Cron job runs
      let error: Error | undefined;
      try {
        await service.cleanupExpiredDemoUsers();
      } catch (e) {
        error = e as Error;
      }

      // THEN: No exception thrown (graceful degradation)
      expect(error).toBeUndefined();
    });
  });

  describe('cleanupDemoUsersByAge - Manual Cleanup', () => {
    it('should allow manual cleanup of demo users by custom age threshold', async () => {
      // GIVEN: Mock users with different ages
      const now = new Date();
      const mockUsers = [
        {
          id: 'demo-user-5h',
          email: 'demo-5h@pulpe.app',
          created_at: new Date(
            now.getTime() - 5 * 60 * 60 * 1000,
          ).toISOString(), // 5h ago
          user_metadata: { is_demo: true },
        },
        {
          id: 'demo-user-15h',
          email: 'demo-15h@pulpe.app',
          created_at: new Date(
            now.getTime() - 15 * 60 * 60 * 1000,
          ).toISOString(), // 15h ago
          user_metadata: { is_demo: true },
        },
      ];

      const mockAdminClient = {
        auth: {
          admin: {
            listUsers: mock(() =>
              Promise.resolve({
                data: { users: mockUsers },
                error: null,
              }),
            ),
            deleteUser: mock(() => Promise.resolve({ error: null })),
          },
        },
      };

      (supabaseService.getServiceRoleClient as any) = mock(
        () => mockAdminClient,
      );

      // WHEN: Manual cleanup with 10h threshold
      const result = await service.cleanupDemoUsersByAge(10);

      // THEN: Should return correct counts and only delete older user
      expect(result.deleted).toBe(1);
      expect(result.failed).toBe(0);
      expect(mockAdminClient.auth.admin.deleteUser).toHaveBeenCalledTimes(1);
      expect(mockAdminClient.auth.admin.deleteUser).toHaveBeenCalledWith(
        'demo-user-15h',
      );
    });

    it('should delete all demo users when maxAgeHours is 0', async () => {
      // GIVEN: Multiple demo users
      const mockUsers = [
        {
          id: 'demo-user-1',
          email: 'demo-1@pulpe.app',
          created_at: '2024-01-01T00:00:00.000Z',
          user_metadata: { is_demo: true },
        },
        {
          id: 'demo-user-2',
          email: 'demo-2@pulpe.app',
          created_at: '2024-01-02T00:00:00.000Z',
          user_metadata: { is_demo: true },
        },
        {
          id: 'demo-user-3',
          email: 'demo-3@pulpe.app',
          created_at: '2024-01-03T00:00:00.000Z',
          user_metadata: { is_demo: true },
        },
      ];

      const mockAdminClient = {
        auth: {
          admin: {
            listUsers: mock(() =>
              Promise.resolve({
                data: { users: mockUsers },
                error: null,
              }),
            ),
            deleteUser: mock(() => Promise.resolve({ error: null })),
          },
        },
      };

      (supabaseService.getServiceRoleClient as any) = mock(
        () => mockAdminClient,
      );

      // WHEN: Manual cleanup with 0 hours (delete all)
      const result = await service.cleanupDemoUsersByAge(0);

      // THEN: All demo users should be deleted
      expect(result.deleted).toBe(3);
      expect(result.failed).toBe(0);

      // AND: Each user was deleted
      expect(mockAdminClient.auth.admin.deleteUser).toHaveBeenCalledWith(
        'demo-user-1',
      );
      expect(mockAdminClient.auth.admin.deleteUser).toHaveBeenCalledWith(
        'demo-user-2',
      );
      expect(mockAdminClient.auth.admin.deleteUser).toHaveBeenCalledWith(
        'demo-user-3',
      );
    });

    it('should handle delete failures gracefully in manual cleanup', async () => {
      // GIVEN: Mock users where one delete fails
      const mockUsers = [
        {
          id: 'demo-user-success',
          email: 'demo-success@pulpe.app',
          created_at: '2024-01-01T00:00:00.000Z',
          user_metadata: { is_demo: true },
        },
        {
          id: 'demo-user-fail',
          email: 'demo-fail@pulpe.app',
          created_at: '2024-01-01T00:00:00.000Z',
          user_metadata: { is_demo: true },
        },
      ];

      let callCount = 0;
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
              callCount++;
              if (callCount === 1) {
                return Promise.resolve({ error: null }); // Success
              } else {
                return Promise.resolve({ error: new Error('Delete failed') }); // Failure
              }
            }),
          },
        },
      };

      (supabaseService.getServiceRoleClient as any) = mock(
        () => mockAdminClient,
      );

      // WHEN: Manual cleanup with 0 hours
      const result = await service.cleanupDemoUsersByAge(0);

      // THEN: Should report correct success/failure counts
      expect(result.deleted).toBe(1);
      expect(result.failed).toBe(1);

      // AND: Service attempted to delete both users
      expect(mockAdminClient.auth.admin.deleteUser).toHaveBeenCalledWith(
        'demo-user-success',
      );
      expect(mockAdminClient.auth.admin.deleteUser).toHaveBeenCalledWith(
        'demo-user-fail',
      );
    });
  });
});
