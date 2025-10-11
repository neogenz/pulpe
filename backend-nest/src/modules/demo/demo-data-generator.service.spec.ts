import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from 'bun:test';
import { DemoDataGeneratorService } from './demo-data-generator.service';

describe('DemoDataGeneratorService - Business Value Tests', () => {
  let service: DemoDataGeneratorService;
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
      ],
    }).compile();

    service = module.get<DemoDataGeneratorService>(DemoDataGeneratorService);
  });

  describe('Template Line Generation - Data Validity', () => {
    it('should never generate template lines with negative amounts', () => {
      // Test the private methods that generate template lines
      // We access them via type assertion for testing

      const serviceAny = service as any;

      // Test standard month lines
      const standardLines = serviceAny.getStandardMonthLines('template-1');
      const negativeLines = standardLines.filter(
        (line: any) => line.amount < 0,
      );
      expect(negativeLines).toHaveLength(0);

      // Test vacation month lines
      const vacationLines = serviceAny.getVacationMonthLines('template-2');
      const negativeVacationLines = vacationLines.filter(
        (line: any) => line.amount < 0,
      );
      expect(negativeVacationLines).toHaveLength(0);

      // Test savings month lines
      const savingsLines = serviceAny.getSavingsMonthLines('template-3');
      const negativeSavingsLines = savingsLines.filter(
        (line: any) => line.amount < 0,
      );
      expect(negativeSavingsLines).toHaveLength(0);

      // Test holiday month lines
      const holidayLines = serviceAny.getHolidayMonthLines('template-4');
      const negativeHolidayLines = holidayLines.filter(
        (line: any) => line.amount < 0,
      );
      expect(negativeHolidayLines).toHaveLength(0);
    });

    it('should never generate template lines with zero amounts', () => {
      const serviceAny = service as any;

      // Test all template types
      const allLines = [
        ...serviceAny.getStandardMonthLines('template-1'),
        ...serviceAny.getVacationMonthLines('template-2'),
        ...serviceAny.getSavingsMonthLines('template-3'),
        ...serviceAny.getHolidayMonthLines('template-4'),
      ];

      const zeroLines = allLines.filter((line: any) => line.amount === 0);
      expect(zeroLines).toHaveLength(0);
    });
  });

  describe('Template Line Generation - Financial Coherence', () => {
    it('should generate templates where income >= expenses + savings', () => {
      const serviceAny = service as any;

      // Test each template type for financial coherence
      const templates = [
        {
          id: 'standard',
          lines: serviceAny.getStandardMonthLines('template-1'),
        },
        {
          id: 'vacation',
          lines: serviceAny.getVacationMonthLines('template-2'),
        },
        { id: 'savings', lines: serviceAny.getSavingsMonthLines('template-3') },
        { id: 'holiday', lines: serviceAny.getHolidayMonthLines('template-4') },
      ];

      for (const template of templates) {
        const totalIncome = template.lines
          .filter((line: any) => line.kind === 'income')
          .reduce((sum: number, line: any) => sum + line.amount, 0);

        const totalExpenses = template.lines
          .filter((line: any) => line.kind === 'expense')
          .reduce((sum: number, line: any) => sum + line.amount, 0);

        const totalSavings = template.lines
          .filter((line: any) => line.kind === 'saving')
          .reduce((sum: number, line: any) => sum + line.amount, 0);

        // Template must be financially coherent
        expect(totalIncome).toBeGreaterThanOrEqual(
          totalExpenses + totalSavings,
        );
      }
    });

    it('should ensure every template has at least one income source', () => {
      const serviceAny = service as any;

      const templates = [
        serviceAny.getStandardMonthLines('template-1'),
        serviceAny.getVacationMonthLines('template-2'),
        serviceAny.getSavingsMonthLines('template-3'),
        serviceAny.getHolidayMonthLines('template-4'),
      ];

      for (const lines of templates) {
        const incomeLines = lines.filter((line: any) => line.kind === 'income');
        expect(incomeLines.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Budget Template Selection - Seasonal Logic', () => {
    it('should assign vacation template for July and August', () => {
      const serviceAny = service as any;

      // Mock templates array
      const mockTemplates = [
        { id: 'standard', name: '💰 Mois Standard' },
        { id: 'vacation', name: '✈️ Mois Vacances' },
        { id: 'savings', name: '🎯 Mois Économies Renforcées' },
        { id: 'holiday', name: '🎄 Mois de Fêtes' },
      ];

      // Test July (month 7)
      const julyResult = serviceAny.selectTemplateForMonth(7, mockTemplates);
      expect(julyResult.template.id).toBe('vacation');
      expect(julyResult.description).toContain('vacances');

      // Test August (month 8)
      const augustResult = serviceAny.selectTemplateForMonth(8, mockTemplates);
      expect(augustResult.template.id).toBe('vacation');
      expect(augustResult.description).toContain('vacances');
    });

    it('should assign holiday template for December', () => {
      const serviceAny = service as any;

      const mockTemplates = [
        { id: 'standard', name: '💰 Mois Standard' },
        { id: 'vacation', name: '✈️ Mois Vacances' },
        { id: 'savings', name: '🎯 Mois Économies Renforcées' },
        { id: 'holiday', name: '🎄 Mois de Fêtes' },
      ];

      const decemberResult = serviceAny.selectTemplateForMonth(
        12,
        mockTemplates,
      );
      expect(decemberResult.template.id).toBe('holiday');
      expect(decemberResult.description).toContain('fêtes');
    });

    it('should assign savings template for March and September', () => {
      const serviceAny = service as any;

      const mockTemplates = [
        { id: 'standard', name: '💰 Mois Standard' },
        { id: 'vacation', name: '✈️ Mois Vacances' },
        { id: 'savings', name: '🎯 Mois Économies Renforcées' },
        { id: 'holiday', name: '🎄 Mois de Fêtes' },
      ];

      // Test March (month 3)
      const marchResult = serviceAny.selectTemplateForMonth(3, mockTemplates);
      expect(marchResult.template.id).toBe('savings');
      expect(marchResult.description).toContain('épargne');

      // Test September (month 9)
      const septemberResult = serviceAny.selectTemplateForMonth(
        9,
        mockTemplates,
      );
      expect(septemberResult.template.id).toBe('savings');
      expect(septemberResult.description).toContain('épargne');
    });

    it('should assign standard template for other months', () => {
      const serviceAny = service as any;

      const mockTemplates = [
        { id: 'standard', name: '💰 Mois Standard' },
        { id: 'vacation', name: '✈️ Mois Vacances' },
        { id: 'savings', name: '🎯 Mois Économies Renforcées' },
        { id: 'holiday', name: '🎄 Mois de Fêtes' },
      ];

      // Test January (month 1)
      const januaryResult = serviceAny.selectTemplateForMonth(1, mockTemplates);
      expect(januaryResult.template.id).toBe('standard');

      // Test May (month 5)
      const mayResult = serviceAny.selectTemplateForMonth(5, mockTemplates);
      expect(mayResult.template.id).toBe('standard');
    });
  });

  describe('Transaction Generation - Temporal Constraints', () => {
    it('should only create transactions for past budgets', () => {
      const serviceAny = service as any;

      // Create mock budgets: some past, some future
      const currentDate = new Date();
      const mockBudgets = [
        {
          id: 'past-budget',
          month: currentDate.getMonth() + 1, // Current month (getMonth() returns 0-based)
          year: currentDate.getFullYear(),
        },
        {
          id: 'future-budget',
          month: currentDate.getMonth() + 3, // Future month (2 months ahead)
          year: currentDate.getFullYear(),
        },
      ];

      // First filter to past budgets, then generate transactions
      const pastBudgets = serviceAny.filterPastBudgets(
        mockBudgets,
        currentDate,
      );
      const transactions = serviceAny.generateTransactions(
        pastBudgets,
        currentDate,
      );

      // Should only have transactions for past/current budgets
      const futureBudgetTransactions = transactions.filter(
        (t: any) => t.budget_id === 'future-budget',
      );

      expect(futureBudgetTransactions).toHaveLength(0);
      // Should have transactions for the past budget
      const pastBudgetTransactions = transactions.filter(
        (t: any) => t.budget_id === 'past-budget',
      );
      expect(pastBudgetTransactions.length).toBeGreaterThan(0);
    });

    it('should create transactions within budget month boundaries', () => {
      const serviceAny = service as any;

      // Test with a specific budget
      const budget = {
        id: 'test-budget',
        month: 3, // March
        year: 2024,
      };

      const transactions = serviceAny.createBudgetTransactions(budget, 31); // Max day

      for (const transaction of transactions) {
        const transactionDate = new Date(transaction.transaction_date);
        expect(transactionDate.getMonth() + 1).toBe(budget.month); // March = month 3
        expect(transactionDate.getFullYear()).toBe(budget.year); // 2024
        expect(transactionDate.getDate()).toBeGreaterThan(0);
        expect(transactionDate.getDate()).toBeLessThanOrEqual(31);
      }
    });
  });
});
