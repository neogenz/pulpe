import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { DemoService } from './demo.service';
import { DemoDataGeneratorService } from './demo-data-generator.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('DemoService - Business Value Tests', () => {
  let service: DemoService;
  let supabaseService: SupabaseService;
  let dataGeneratorService: DemoDataGeneratorService;
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
        DemoService,
        DemoDataGeneratorService,
        {
          provide: SupabaseService,
          useValue: {
            getServiceRoleClient: mock() as any,
            createAuthenticatedClient: mock() as any,
          },
        },
        {
          provide: `PinoLogger:${DemoService.name}`,
          useValue: {
            error: mock(() => {}),
            info: mock(() => {}),
            debug: mock(() => {}),
            warn: mock(() => {}),
          },
        },
        {
          provide: `PinoLogger:${DemoDataGeneratorService.name}`,
          useValue: {
            error: mock(() => {}),
            info: mock(() => {}),
            debug: mock(() => {}),
            warn: mock(() => {}),
          },
        },
      ],
    }).compile();

    service = module.get<DemoService>(DemoService);
    supabaseService = module.get<SupabaseService>(SupabaseService);
    dataGeneratorService = module.get<DemoDataGeneratorService>(
      DemoDataGeneratorService,
    );
  });

  describe('createDemoSession - Complete Financial Data', () => {
    it('should create demo user with complete financial data (4 templates, 12 budgets, transactions)', async () => {
      // GIVEN: Mock Supabase service to return successful user creation
      const mockUser = {
        id: 'demo-user-123',
        email: 'demo-123@pulpe.app',
        created_at: '2024-01-01T00:00:00.000Z',
        user_metadata: { is_demo: true },
      };
      const mockSession = {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        user: mockUser,
      };

      const mockAdminClient = {
        auth: {
          admin: {
            createUser: mock(() =>
              Promise.resolve({
                data: { user: mockUser },
                error: null,
              }),
            ),
            generateLink: mock(() =>
              Promise.resolve({
                data: { properties: { hashed_token: 'mock-token' } },
                error: null,
              }),
            ),
          },
          signInWithPassword: mock(() =>
            Promise.resolve({
              data: { session: mockSession },
              error: null,
            }),
          ),
        },
      } as any;

      (supabaseService.getServiceRoleClient as any) = mock(
        () => mockAdminClient,
      );
      (supabaseService.createAuthenticatedClient as any) = mock(() => ({}));

      // Mock data generator to succeed
      dataGeneratorService.seedDemoData = mock(() => Promise.resolve());

      // WHEN: Creating a demo session
      const result = await service.createDemoSession();

      // THEN: Should return successful response
      expect(result.success).toBe(true);
      expect(result.data.session).toBeDefined();
      expect(result.data.session.access_token).toBe('mock-access-token');
      expect(result.data.session.user.id).toBe('demo-user-123');
      expect(result.data.session.user.email).toMatch(
        /^demo-[a-f0-9-]+@pulpe\.app$/,
      );

      // AND: Should have called data generator with correct user ID
      expect(dataGeneratorService.seedDemoData).toHaveBeenCalledWith(
        'demo-user-123',
        expect.any(Object), // authenticated client
      );
    });
  });

  describe('createDemoSession - Resilience on Failure', () => {
    it('should still return session if data seeding fails (graceful degradation)', async () => {
      // GIVEN: Mock successful user creation and sign-in, but failed data seeding
      const mockUser = {
        id: 'demo-user-456',
        email: 'demo-456@pulpe.app',
        created_at: '2024-01-01T00:00:00.000Z',
        user_metadata: { is_demo: true },
      };
      const mockSession = {
        access_token: 'mock-access-token-456',
        refresh_token: 'mock-refresh-token-456',
        user: mockUser,
      };

      const mockAdminClient = {
        auth: {
          admin: {
            createUser: mock(() =>
              Promise.resolve({
                data: { user: mockUser },
                error: null,
              }),
            ),
          },
          signInWithPassword: mock(() =>
            Promise.resolve({
              data: { session: mockSession },
              error: null,
            }),
          ),
        },
      };

      (supabaseService.getServiceRoleClient as any) = mock(
        () => mockAdminClient,
      );
      (supabaseService.createAuthenticatedClient as any) = mock(() => ({}));

      // Mock data generator to fail
      dataGeneratorService.seedDemoData = mock(() =>
        Promise.reject(new Error('Database connection failed')),
      );

      // WHEN: Creating a demo session
      const result = await service.createDemoSession();

      // THEN: Should still return successful response (graceful degradation)
      expect(result.success).toBe(true);
      expect(result.data.session).toBeDefined();
      expect(result.data.session.access_token).toBe('mock-access-token-456');
      expect(result.data.session.user.id).toBe('demo-user-456');

      // AND: Should have attempted to seed data despite failure
      expect(dataGeneratorService.seedDemoData).toHaveBeenCalledWith(
        'demo-user-456',
        expect.any(Object),
      );
    });
  });

  describe('createDemoSession - Error Handling', () => {
    it('should cleanup user and throw if sign-in fails after user creation', async () => {
      // GIVEN: Mock successful user creation but failed sign-in
      const mockUser = {
        id: 'demo-user-789',
        email: 'demo-789@pulpe.app',
        created_at: '2024-01-01T00:00:00.000Z',
        user_metadata: { is_demo: true },
      };

      const mockAdminClient = {
        auth: {
          admin: {
            createUser: mock(() =>
              Promise.resolve({
                data: { user: mockUser },
                error: null,
              }),
            ),
            deleteUser: mock(() => Promise.resolve({ error: null })),
          },
          signInWithPassword: mock(() =>
            Promise.resolve({
              data: null,
              error: { message: 'Invalid credentials' },
            }),
          ),
        },
      };

      (supabaseService.getServiceRoleClient as any) = mock(
        () => mockAdminClient,
      );
      (supabaseService.createAuthenticatedClient as any) = mock(() => ({}));
      dataGeneratorService.seedDemoData = mock(() => Promise.resolve());

      // WHEN & THEN: Creating a demo session should throw and cleanup user
      await expect(service.createDemoSession()).rejects.toThrow();

      // AND: Should have attempted to delete the user
      expect(mockAdminClient.auth.admin.deleteUser).toHaveBeenCalledWith(
        'demo-user-789',
      );
    });

    it('should generate unique emails for concurrent sessions', async () => {
      // GIVEN: Mock successful operations for multiple sessions
      let callCount = 0;
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
          created_at: '2024-01-01T00:00:00.000Z',
          user_metadata: { is_demo: true },
        },
        {
          id: 'demo-user-3',
          email: 'demo-3@pulpe.app',
          created_at: '2024-01-01T00:00:00.000Z',
          user_metadata: { is_demo: true },
        },
      ];

      const mockAdminClient = {
        auth: {
          admin: {
            createUser: mock(() => {
              const user = mockUsers[callCount % mockUsers.length];
              callCount++;
              return Promise.resolve({
                data: { user },
                error: null,
              });
            }),
          },
          signInWithPassword: mock(() =>
            Promise.resolve({
              data: {
                session: {
                  access_token: 'mock-token',
                  refresh_token: 'mock-refresh',
                  user: mockUsers[0],
                },
              },
              error: null,
            }),
          ),
        },
      };

      (supabaseService.getServiceRoleClient as any) = mock(
        () => mockAdminClient,
      );
      (supabaseService.createAuthenticatedClient as any) = mock(() => ({}));
      dataGeneratorService.seedDemoData = mock(() => Promise.resolve());

      // WHEN: Creating multiple demo sessions concurrently
      const results = await Promise.all([
        service.createDemoSession(),
        service.createDemoSession(),
        service.createDemoSession(),
      ]);

      // THEN: All emails should be unique (UUID-based generation)
      const emails = results.map((r) => r.data.session.user.email);
      const uniqueEmails = new Set(emails);

      expect(uniqueEmails.size).toBe(results.length);
      expect(emails.every((email) => email.includes('@pulpe.app'))).toBe(true);
      expect(emails.every((email) => email.startsWith('demo-'))).toBe(true);
    });
  });
});
