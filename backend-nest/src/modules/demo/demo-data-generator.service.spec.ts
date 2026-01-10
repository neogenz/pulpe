import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from 'bun:test';
import { BudgetCalculator } from '../budget/budget.calculator';
import type { AuthenticatedSupabaseClient } from '../supabase/supabase.service';
import { DemoDataGeneratorService } from './demo-data-generator.service';

describe('DemoDataGeneratorService - Integration Tests', () => {
  let service: DemoDataGeneratorService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({})],
        }),
      ],
      providers: [
        DemoDataGeneratorService,
        {
          provide: `PinoLogger:${DemoDataGeneratorService.name}`,
          useValue: {
            error: () => {},
            info: () => {},
            debug: () => {},
            warn: () => {},
          },
        },
        {
          provide: BudgetCalculator,
          useValue: {
            recalculateAndPersist: async () => {},
          },
        },
      ],
    }).compile();

    service = module.get<DemoDataGeneratorService>(DemoDataGeneratorService);
  });

  describe('Demo user gets complete financial setup', () => {
    it('should create 4 budget templates with distinct purposes', async () => {
      // GIVEN: Mock Supabase client that tracks insertions
      const insertedTemplates: any[] = [];
      const mockSupabase = createMockSupabaseClient(insertedTemplates);

      // WHEN: Seeding demo data for a new user
      await service.seedDemoData('test-user-123', mockSupabase);

      // THEN: Should create exactly 4 templates
      expect(insertedTemplates).toHaveLength(4);

      // AND: Templates should have distinct names and purposes
      const templateNames = insertedTemplates.map((t) => t.name);
      expect(templateNames).toContain('💰 Mois Standard');
      expect(templateNames).toContain('✈️ Mois Vacances');
      expect(templateNames).toContain('🎯 Mois Économies Renforcées');
      expect(templateNames).toContain('🎄 Mois de Fêtes');

      // AND: Exactly one template should be marked as default
      const defaultTemplates = insertedTemplates.filter((t) => t.is_default);
      expect(defaultTemplates).toHaveLength(1);
      expect(defaultTemplates[0].name).toBe('💰 Mois Standard');
    });

    it('should create template lines with valid financial amounts', async () => {
      // GIVEN: Mock Supabase client that tracks template lines
      const insertedLines: any[] = [];
      const mockSupabase = createMockSupabaseClient([], insertedLines);

      // WHEN: Seeding demo data
      await service.seedDemoData('test-user-123', mockSupabase);

      // THEN: All amounts must be positive
      const negativeAmounts = insertedLines.filter((line) => line.amount < 0);
      expect(negativeAmounts).toHaveLength(0);

      // AND: No zero amounts allowed
      const zeroAmounts = insertedLines.filter((line) => line.amount === 0);
      expect(zeroAmounts).toHaveLength(0);

      // AND: Each line must have required fields
      for (const line of insertedLines) {
        expect(line.name).toBeDefined();
        expect(line.amount).toBeGreaterThan(0);
        expect(line.kind).toMatch(/^(income|expense|saving)$/);
        expect(line.recurrence).toMatch(/^(fixed|one_off)$/);
      }
    });

    it('should ensure financial coherence in all templates', async () => {
      // GIVEN: Mock Supabase client tracking both templates and lines
      const insertedTemplates: any[] = [];
      const insertedLines: any[] = [];
      const mockSupabase = createMockSupabaseClient(
        insertedTemplates,
        insertedLines,
      );

      // WHEN: Seeding demo data
      await service.seedDemoData('test-user-123', mockSupabase);

      // THEN: For each template, income must cover expenses + savings
      const templateIds = insertedTemplates.map((t) => t.id);

      for (const templateId of templateIds) {
        const templateLines = insertedLines.filter(
          (l) => l.template_id === templateId,
        );

        const totalIncome = templateLines
          .filter((l) => l.kind === 'income')
          .reduce((sum, l) => sum + l.amount, 0);

        const totalExpenses = templateLines
          .filter((l) => l.kind === 'expense')
          .reduce((sum, l) => sum + l.amount, 0);

        const totalSavings = templateLines
          .filter((l) => l.kind === 'saving')
          .reduce((sum, l) => sum + l.amount, 0);

        // Financial coherence: can't spend/save more than you earn
        expect(totalIncome).toBeGreaterThanOrEqual(
          totalExpenses + totalSavings,
        );

        // Every template must have at least one income source
        const incomeLines = templateLines.filter((l) => l.kind === 'income');
        expect(incomeLines.length).toBeGreaterThan(0);
      }
    });

    it('should create 12 monthly budgets spanning past and future', async () => {
      // GIVEN: Mock Supabase client tracking budgets
      const insertedBudgets: any[] = [];
      const mockSupabase = createMockSupabaseClient([], [], insertedBudgets);

      // WHEN: Seeding demo data
      await service.seedDemoData('test-user-123', mockSupabase);

      // THEN: Should create exactly 12 budgets
      expect(insertedBudgets).toHaveLength(12);

      // AND: Each budget should have valid month/year
      for (const budget of insertedBudgets) {
        expect(budget.month).toBeGreaterThanOrEqual(1);
        expect(budget.month).toBeLessThanOrEqual(12);
        expect(budget.year).toBeGreaterThan(2020);
      }

      // AND: Budgets should be distributed around current date
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;

      // Should have some past budgets
      const pastBudgets = insertedBudgets.filter(
        (b) =>
          b.year < currentYear ||
          (b.year === currentYear && b.month < currentMonth),
      );
      expect(pastBudgets.length).toBeGreaterThan(0);

      // Should have some future budgets
      const futureBudgets = insertedBudgets.filter(
        (b) =>
          b.year > currentYear ||
          (b.year === currentYear && b.month > currentMonth),
      );
      expect(futureBudgets.length).toBeGreaterThan(0);
    });

    it('should apply seasonal template logic to budgets', async () => {
      // GIVEN: Mock Supabase client tracking templates and budgets
      const insertedTemplates: any[] = [];
      const insertedBudgets: any[] = [];
      const mockSupabase = createMockSupabaseClient(
        insertedTemplates,
        [],
        insertedBudgets,
      );

      // WHEN: Seeding demo data
      await service.seedDemoData('test-user-123', mockSupabase);

      // THEN: Budgets should use appropriate templates for their month
      const vacationTemplate = insertedTemplates.find((t) =>
        t.name.includes('Vacances'),
      );
      const holidayTemplate = insertedTemplates.find((t) =>
        t.name.includes('Fêtes'),
      );

      // Summer months (7, 8) should use vacation template
      const summerBudgets = insertedBudgets.filter(
        (b) => b.month === 7 || b.month === 8,
      );
      for (const budget of summerBudgets) {
        expect(budget.template_id).toBe(vacationTemplate?.id);
      }

      // December should use holiday template
      const decemberBudgets = insertedBudgets.filter((b) => b.month === 12);
      for (const budget of decemberBudgets) {
        expect(budget.template_id).toBe(holidayTemplate?.id);
      }
    });

    it('should create budget lines matching their template structure', async () => {
      // GIVEN: Mock Supabase client tracking all data
      const insertedTemplates: any[] = [];
      const insertedTemplateLines: any[] = [];
      const insertedBudgets: any[] = [];
      const insertedBudgetLines: any[] = [];
      const mockSupabase = createMockSupabaseClient(
        insertedTemplates,
        insertedTemplateLines,
        insertedBudgets,
        insertedBudgetLines,
      );

      // WHEN: Seeding demo data
      await service.seedDemoData('test-user-123', mockSupabase);

      // THEN: Each budget should have budget lines from its template
      for (const budget of insertedBudgets) {
        const budgetLines = insertedBudgetLines.filter(
          (bl) => bl.budget_id === budget.id,
        );
        const templateLines = insertedTemplateLines.filter(
          (tl) => tl.template_id === budget.template_id,
        );

        // Should have same number of lines
        expect(budgetLines.length).toBe(templateLines.length);

        // Budget lines should match template structure
        for (const budgetLine of budgetLines) {
          const matchingTemplateLine = templateLines.find(
            (tl) => tl.id === budgetLine.template_line_id,
          );
          expect(matchingTemplateLine).toBeDefined();
          expect(budgetLine.name).toBe(matchingTemplateLine.name);
          expect(budgetLine.amount).toBe(matchingTemplateLine.amount);
          expect(budgetLine.kind).toBe(matchingTemplateLine.kind);
        }
      }
    });

    it('should only create transactions for past budgets', async () => {
      // GIVEN: Mock Supabase client tracking budgets and transactions
      const insertedBudgets: any[] = [];
      const insertedTransactions: any[] = [];
      const mockSupabase = createMockSupabaseClient(
        [],
        [],
        insertedBudgets,
        [],
        insertedTransactions,
      );

      // WHEN: Seeding demo data
      await service.seedDemoData('test-user-123', mockSupabase);

      // THEN: Transactions should only exist for past/current budgets
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;

      for (const transaction of insertedTransactions) {
        const budget = insertedBudgets.find(
          (b) => b.id === transaction.budget_id,
        );
        expect(budget).toBeDefined();

        // Transaction's budget must not be in the future
        const isFuture =
          budget.year > currentYear ||
          (budget.year === currentYear && budget.month > currentMonth);
        expect(isFuture).toBe(false);
      }
    });

    it('should create transactions within their budget month boundaries', async () => {
      // GIVEN: Mock Supabase client tracking budgets and transactions
      const insertedBudgets: any[] = [];
      const insertedTransactions: any[] = [];
      const mockSupabase = createMockSupabaseClient(
        [],
        [],
        insertedBudgets,
        [],
        insertedTransactions,
      );

      // WHEN: Seeding demo data
      await service.seedDemoData('test-user-123', mockSupabase);

      // THEN: Each transaction must be within its budget's month
      for (const transaction of insertedTransactions) {
        const budget = insertedBudgets.find(
          (b) => b.id === transaction.budget_id,
        );
        expect(budget).toBeDefined();

        const transactionDate = new Date(transaction.transaction_date);
        expect(transactionDate.getMonth() + 1).toBe(budget.month);
        expect(transactionDate.getFullYear()).toBe(budget.year);

        // Day must be valid for that month
        const daysInMonth = new Date(budget.year, budget.month, 0).getDate();
        expect(transactionDate.getDate()).toBeGreaterThan(0);
        expect(transactionDate.getDate()).toBeLessThanOrEqual(daysInMonth);
      }
    });
  });

  describe('Data generation handles edge cases', () => {
    it('should handle Supabase insert failures gracefully', async () => {
      // GIVEN: Mock Supabase client that fails on insert
      const mockSupabase = {
        from: () => ({
          insert: () => ({
            select: async () => ({ data: null, error: new Error('DB error') }),
          }),
        }),
      } as unknown as AuthenticatedSupabaseClient;

      // WHEN: Attempting to seed demo data
      // THEN: Should propagate error (no silent failures)
      await expect(
        service.seedDemoData('test-user-123', mockSupabase),
      ).rejects.toThrow('DB error');
    });
  });
});

/**
 * Helper to create a mock Supabase client that tracks insertions
 * Returns data with generated IDs to simulate real DB behavior
 */
function createMockSupabaseClient(
  insertedTemplates: any[] = [],
  insertedTemplateLines: any[] = [],
  insertedBudgets: any[] = [],
  insertedBudgetLines: any[] = [],
  insertedTransactions: any[] = [],
): AuthenticatedSupabaseClient {
  let templateIdCounter = 1;
  let templateLineIdCounter = 1;
  let budgetIdCounter = 1;
  let budgetLineIdCounter = 1;
  let transactionIdCounter = 1;

  return {
    from: (table: string) => {
      return {
        insert: (data: any[]) => {
          return {
            select: async () => {
              let insertedData: any[];

              switch (table) {
                case 'template':
                  insertedData = data.map((item) => ({
                    ...item,
                    id: `template-${templateIdCounter++}`,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  }));
                  insertedTemplates.push(...insertedData);
                  break;

                case 'template_line':
                  insertedData = data.map((item) => ({
                    ...item,
                    id: `template-line-${templateLineIdCounter++}`,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  }));
                  insertedTemplateLines.push(...insertedData);
                  break;

                case 'monthly_budget':
                  insertedData = data.map((item) => ({
                    ...item,
                    id: `budget-${budgetIdCounter++}`,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  }));
                  insertedBudgets.push(...insertedData);
                  break;

                case 'budget_line':
                  insertedData = data.map((item) => ({
                    ...item,
                    id: `budget-line-${budgetLineIdCounter++}`,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  }));
                  insertedBudgetLines.push(...insertedData);
                  break;

                case 'transaction':
                  insertedData = data.map((item) => ({
                    ...item,
                    id: `transaction-${transactionIdCounter++}`,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  }));
                  insertedTransactions.push(...insertedData);
                  break;

                default:
                  return { data: null, error: new Error('Unknown table') };
              }

              return { data: insertedData, error: null };
            },
          };
        },
      };
    },
  } as unknown as AuthenticatedSupabaseClient;
}
