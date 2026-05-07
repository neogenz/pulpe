import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import { BUDGET_RECALCULATION_PORT } from '../../budget/domain/ports/budget-recalculation.port';
import { ENCRYPTION_PORT } from '../../encryption/encryption.tokens';
import { DEMO_REPOSITORY } from '../domain/ports/demo-repository.port';
import { GenerateDemoDataUseCase } from './generate-demo-data.use-case';
import { ConfigModule } from '@nestjs/config';

function buildMockRepo() {
  return {
    insertTemplates: mock(async (rows: unknown[]) =>
      rows.map((_, i) => ({ id: `template-${i}`, user_id: 'user-1' })),
    ),
    insertTemplateLines: mock(async (rows: unknown[]) =>
      rows.map((r, i) => ({ ...(r as object), id: `tl-${i}` })),
    ),
    insertBudgets: mock(async (rows: unknown[]) =>
      rows.map((r, i) => ({ ...(r as object), id: `budget-${i}` })),
    ),
    insertBudgetLines: mock(async () => {}),
    insertTransactions: mock(async () => {}),
  };
}

describe('GenerateDemoDataUseCase', () => {
  let useCase: GenerateDemoDataUseCase;
  let mockRepo: ReturnType<typeof buildMockRepo>;
  let module: TestingModule;

  beforeEach(async () => {
    mockRepo = buildMockRepo();

    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, load: [() => ({})] })],
      providers: [
        GenerateDemoDataUseCase,
        { provide: DEMO_REPOSITORY, useValue: mockRepo },
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
          useValue: { recalculate: mock(async () => {}) },
        },
        {
          provide: `INFO_LOGGER:${GenerateDemoDataUseCase.name}`,
          useValue: { info: mock(() => {}), warn: mock(() => {}) },
        },
      ],
    }).compile();

    useCase = module.get(GenerateDemoDataUseCase);
  });

  describe('execute - complete financial setup', () => {
    it('should create 4 templates via repository', async () => {
      await useCase.execute('user-1', {} as any);

      const [[templatesInserted]] = (
        mockRepo.insertTemplates as ReturnType<typeof mock>
      ).mock.calls;
      expect((templatesInserted as unknown[]).length).toBe(4);
    });

    it('should create 12 monthly budgets (6 past + 6 future)', async () => {
      await useCase.execute('user-1', {} as any);

      const [[budgetsInserted]] = (
        mockRepo.insertBudgets as ReturnType<typeof mock>
      ).mock.calls;
      expect((budgetsInserted as unknown[]).length).toBe(12);
    });

    it('should call recalculate for each budget', async () => {
      const mockRecalc = mock(async () => {});
      module = await Test.createTestingModule({
        imports: [ConfigModule.forRoot({ isGlobal: true, load: [() => ({})] })],
        providers: [
          GenerateDemoDataUseCase,
          { provide: DEMO_REPOSITORY, useValue: buildMockRepo() },
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
            useValue: { recalculate: mockRecalc },
          },
          {
            provide: `INFO_LOGGER:${GenerateDemoDataUseCase.name}`,
            useValue: { info: mock(() => {}), warn: mock(() => {}) },
          },
        ],
      }).compile();

      const uc = module.get(GenerateDemoDataUseCase);
      await uc.execute('user-1', {} as any);

      expect(mockRecalc.mock.calls.length).toBe(12);
    });

    it('should throw if repository fails', async () => {
      mockRepo.insertTemplates = mock(async () => {
        throw new Error('DB error');
      });

      await expect(useCase.execute('user-1', {} as any)).rejects.toThrow(
        'DB error',
      );
    });
  });
});
