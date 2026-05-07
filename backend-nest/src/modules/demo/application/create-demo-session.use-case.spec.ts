import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import { BUDGET_RECALCULATION_PORT } from '../../budget/domain/ports/budget-recalculation.port';
import { ENCRYPTION_PORT } from '../../encryption/encryption.tokens';
import { DEMO_CREDENTIALS_PORT } from '../domain/ports/demo-credentials.port';
import { DEMO_REPOSITORY } from '../domain/ports/demo-repository.port';
import { CreateDemoSessionUseCase } from './create-demo-session.use-case';
import { GenerateDemoDataUseCase } from './generate-demo-data.use-case';
import { SupabaseService } from '../../supabase/supabase.service';
import { ConfigModule } from '@nestjs/config';

describe('CreateDemoSessionUseCase', () => {
  let useCase: CreateDemoSessionUseCase;
  let generateDemoData: GenerateDemoDataUseCase;
  let mockCreds: {
    generateCredentials: ReturnType<typeof mock>;
    createDemoUser: ReturnType<typeof mock>;
    signInDemoUser: ReturnType<typeof mock>;
    deleteUser: ReturnType<typeof mock>;
    listExpiredDemoUsers: ReturnType<typeof mock>;
    bulkDeleteUsers: ReturnType<typeof mock>;
  };
  let module: TestingModule;

  beforeEach(async () => {
    mockCreds = {
      generateCredentials: mock(() => ({
        email: 'demo-uuid@pulpe.app',
        password: 'some-password',
      })),
      createDemoUser: mock(async () => ({
        userId: 'test-user-id',
        user: { id: 'test-user-id' },
      })),
      signInDemoUser: mock(async () => ({
        session: {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          expires_in: 3600,
          expires_at: 9999999999,
          user: { created_at: '2024-01-01T00:00:00.000Z' },
        },
        user: { id: 'test-user-id' },
      })),
      deleteUser: mock(async () => {}),
      listExpiredDemoUsers: mock(async () => []),
      bulkDeleteUsers: mock(async () => ({ fulfilled: [], rejected: [] })),
    };

    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, load: [() => ({})] })],
      providers: [
        CreateDemoSessionUseCase,
        GenerateDemoDataUseCase,
        {
          provide: SupabaseService,
          useValue: {
            createAuthenticatedClient: mock(() => ({})),
          },
        },
        { provide: DEMO_CREDENTIALS_PORT, useValue: mockCreds },
        {
          provide: DEMO_REPOSITORY,
          useValue: {
            insertTemplates: mock(async () => []),
            insertTemplateLines: mock(async () => []),
            insertBudgets: mock(async () => []),
            insertBudgetLines: mock(async () => {}),
            insertTransactions: mock(async () => {}),
          },
        },
        {
          provide: ENCRYPTION_PORT,
          useValue: {
            ensureUserDEK: async () => Buffer.alloc(32),
            encryptAmount: () => 'encrypted',
            decryptAmount: () => 100,
          },
        },
        {
          provide: BUDGET_RECALCULATION_PORT,
          useValue: { recalculate: async () => {} },
        },
        {
          provide: `INFO_LOGGER:${CreateDemoSessionUseCase.name}`,
          useValue: { info: mock(() => {}), warn: mock(() => {}) },
        },
        {
          provide: `INFO_LOGGER:${GenerateDemoDataUseCase.name}`,
          useValue: { info: mock(() => {}), warn: mock(() => {}) },
        },
      ],
    }).compile();

    useCase = module.get(CreateDemoSessionUseCase);
    generateDemoData = module.get(GenerateDemoDataUseCase);
  });

  describe('execute - successful flow', () => {
    it('should return a valid DemoSessionResponse with JWT tokens', async () => {
      const result = await useCase.execute();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Demo session created successfully');
      expect(result.data.session.access_token).toBe('mock-access-token');
      expect(result.data.session.refresh_token).toBe('mock-refresh-token');
      expect(result.data.session.token_type).toBe('bearer');
      expect(result.data.session.user.id).toBe('test-user-id');
    });

    it('should call generateCredentials and createDemoUser', async () => {
      await useCase.execute();

      expect(mockCreds.generateCredentials).toHaveBeenCalled();
      expect(mockCreds.createDemoUser).toHaveBeenCalledWith(
        'demo-uuid@pulpe.app',
        'some-password',
      );
    });
  });

  describe('execute - graceful degradation', () => {
    it('should return session even if data seeding fails', async () => {
      generateDemoData.execute = mock(async () => {
        throw new Error('Seed failed');
      });

      const result = await useCase.execute();

      expect(result.success).toBe(true);
      expect(result.data.session.access_token).toBe('mock-access-token');
    });
  });

  describe('execute - error handling', () => {
    it('should delete user and rethrow if sign-in fails after user creation', async () => {
      mockCreds.signInDemoUser = mock(async () => {
        throw new Error('Sign-in failed');
      });

      await expect(useCase.execute()).rejects.toThrow();
      expect(mockCreds.deleteUser).toHaveBeenCalledWith('test-user-id');
    });
  });
});
