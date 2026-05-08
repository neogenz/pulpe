import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { BUDGET_RECALCULATION_PORT } from '../../budget/domain/ports/budget-recalculation.port';
import { DEMO_REPOSITORY } from '../domain/ports/demo-repository.port';
import { GenerateDemoDataUseCase } from './generate-demo-data.use-case';

function buildMockRepo() {
  return {
    insertTemplates: mock(async (rows: unknown[]) =>
      rows.map((_, i) => ({ id: `template-${i}` })),
    ),
    insertCanonicalTemplateLines: mock(async () => [
      {
        id: 'tl-0',
        templateId: 'template-0',
        name: 'Salaire',
        amount: 6500,
        kind: 'income' as const,
        recurrence: 'fixed' as const,
      },
    ]),
    insertBudgets: mock(async (rows: unknown[]) =>
      rows.map(
        (r, i) =>
          ({
            ...(r as object),
            id: `budget-${i}`,
            templateId: (r as { templateId: string }).templateId,
          }) as unknown,
      ),
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
      await useCase.execute('user-1', {} as never);

      const [[templatesInserted]] = (
        mockRepo.insertTemplates as ReturnType<typeof mock>
      ).mock.calls;
      expect((templatesInserted as unknown[]).length).toBe(4);
    });

    it('should create 12 monthly budgets (6 past + 6 future)', async () => {
      await useCase.execute('user-1', {} as never);

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
      await uc.execute('user-1', {} as never);

      expect(mockRecalc.mock.calls.length).toBe(12);
    });

    it('should pass userId to repo encryption-aware methods', async () => {
      await useCase.execute('user-7', {} as never);

      const linesCall = (
        mockRepo.insertCanonicalTemplateLines as ReturnType<typeof mock>
      ).mock.calls[0];
      expect(linesCall[1]).toBe('user-7');

      const budgetLinesCall = (
        mockRepo.insertBudgetLines as ReturnType<typeof mock>
      ).mock.calls[0];
      expect(budgetLinesCall[1]).toBe('user-7');

      const transactionsCall = (
        mockRepo.insertTransactions as ReturnType<typeof mock>
      ).mock.calls[0];
      expect(transactionsCall[1]).toBe('user-7');
    });

    it('should throw if repository fails', async () => {
      mockRepo.insertTemplates = mock(async () => {
        throw new Error('DB error');
      });

      await expect(useCase.execute('user-1', {} as never)).rejects.toThrow(
        'DB error',
      );
    });
  });
});
