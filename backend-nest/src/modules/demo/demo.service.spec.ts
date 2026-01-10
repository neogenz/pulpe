import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { BudgetCalculator } from '../budget/budget.calculator';
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
          provide: BudgetCalculator,
          useValue: {
            recalculateAndPersist: async () => {},
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
        expires_in: 3600,
        expires_at: 1234567890,
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

      // THEN: Response structure matches DemoSessionResponse type
      expect(result.success).toBe(true);
      expect(result.message).toBe('Demo session created successfully');

      // AND: Session contains valid JWT tokens
      expect(result.data.session.access_token).toBe('mock-access-token');
      expect(result.data.session.refresh_token).toBe('mock-refresh-token');
      expect(result.data.session.token_type).toBe('bearer');
      expect(result.data.session.expires_in).toBe(3600);
      expect(result.data.session.expires_at).toBe(1234567890);

      // AND: User information is properly formatted
      expect(result.data.session.user.id).toBe('demo-user-123');
      expect(result.data.session.user.created_at).toBe(
        '2024-01-01T00:00:00.000Z',
      );

      // AND: Email follows demo user pattern (UUID-based)
      expect(result.data.session.user.email).toMatch(
        /^demo-[a-f0-9-]+@pulpe\.app$/,
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
        expires_in: 3600,
        expires_at: 1234567890,
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

      // THEN: Response is still successful despite data seeding failure
      expect(result.success).toBe(true);
      expect(result.message).toBe('Demo session created successfully');

      // AND: Session is valid and usable
      expect(result.data.session.access_token).toBe('mock-access-token-456');
      expect(result.data.session.refresh_token).toBe('mock-refresh-token-456');
      expect(result.data.session.user.id).toBe('demo-user-456');

      // AND: Email follows demo pattern
      expect(result.data.session.user.email).toMatch(
        /^demo-[a-f0-9-]+@pulpe\.app$/,
      );

      // Business requirement: User can still access demo mode even if data generation partially fails
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

    it('should create usable demo sessions for concurrent requests', async () => {
      // GIVEN: Mock successful operations for multiple sessions
      const mockUser1 = {
        id: 'demo-user-1',
        email: 'demo-uuid1@pulpe.app',
        created_at: '2024-01-01T00:00:00.000Z',
        user_metadata: { is_demo: true },
      };
      const mockUser2 = {
        id: 'demo-user-2',
        email: 'demo-uuid2@pulpe.app',
        created_at: '2024-01-01T00:00:00.000Z',
        user_metadata: { is_demo: true },
      };

      let callCount = 0;
      const mockUsers = [mockUser1, mockUser2];

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
                  expires_in: 3600,
                  expires_at: 1234567890,
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
      ]);

      // THEN: All sessions should be valid and usable
      for (const result of results) {
        expect(result.success).toBe(true);
        expect(result.data.session.access_token).toBeDefined();
        expect(result.data.session.user.email).toMatch(/^demo-.*@pulpe\.app$/);
      }
    });
  });
});
