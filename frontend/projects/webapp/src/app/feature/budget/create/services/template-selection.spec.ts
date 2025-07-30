import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TemplateSelection } from './template-selection';
import { TemplateApi } from '../../../../core/template/template-api';
import { type TemplateLine, type BudgetTemplate } from '@pulpe/shared';
import { createMockResourceRef } from '../../../../core/testing';

// Mock interfaces for tests
interface TemplateTotals {
  totalIncome: number;
  totalExpenses: number;
  remainingLivingAllowance: number;
  loading: boolean;
}

// Helper to create test template lines
const createTestLine = (partial: Partial<TemplateLine>): TemplateLine => ({
  id: '1',
  templateId: 'template-1',
  name: 'Test',
  amount: 100,
  kind: 'INCOME',
  recurrence: 'fixed',
  description: 'Test description',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...partial,
});

// Helper to create test budget template
const createTestTemplate = (
  partial: Partial<BudgetTemplate>,
): BudgetTemplate => ({
  id: 'template-1',
  name: 'Test Template',
  description: 'Test description',
  isDefault: false,
  userId: 'user-1',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...partial,
});

describe('TemplateSelection', () => {
  let service: TemplateSelection;
  let mockTemplateApi: Partial<TemplateApi>;

  beforeEach(async () => {
    // Create a type-safe ResourceRef mock using helper
    const templatesResourceMock = createMockResourceRef<
      BudgetTemplate[] | undefined
    >([]);

    mockTemplateApi = {
      templatesResource: templatesResourceMock,
      getTemplateLines$: vi.fn(),
    };

    await TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        TemplateSelection,
        { provide: TemplateApi, useValue: mockTemplateApi },
      ],
    }).compileComponents();

    service = TestBed.inject(TemplateSelection);
  });

  describe('calculateTemplateTotals', () => {
    // Test the pure calculation function directly
    const testCalculation = (lines: TemplateLine[]): TemplateTotals => {
      return service.calculateTemplateTotals(lines);
    };
    it('should calculate totals correctly with all transaction types', () => {
      const templateLines: TemplateLine[] = [
        createTestLine({
          id: '1',
          name: 'Salary',
          amount: 5000,
          kind: 'INCOME',
        }),
        createTestLine({
          id: '2',
          name: 'Freelance',
          amount: 1000,
          kind: 'INCOME',
        }),
        createTestLine({
          id: '3',
          name: 'Rent',
          amount: 1500,
          kind: 'FIXED_EXPENSE',
        }),
        createTestLine({
          id: '4',
          name: 'Insurance',
          amount: 300,
          kind: 'FIXED_EXPENSE',
        }),
        createTestLine({
          id: '5',
          name: 'Savings',
          amount: 500,
          kind: 'SAVINGS_CONTRIBUTION',
        }),
      ];

      const totals = testCalculation(templateLines);

      expect(totals.totalIncome).toBe(6000); // 5000 + 1000
      expect(totals.totalExpenses).toBe(2300); // 1500 + 300 + 500
    });

    it('should return zero totals for empty array', () => {
      const templateLines: TemplateLine[] = [];

      const totals = testCalculation(templateLines);

      expect(totals.totalIncome).toBe(0);
      expect(totals.totalExpenses).toBe(0);
    });

    it('should handle only income transactions', () => {
      const templateLines: TemplateLine[] = [
        createTestLine({
          id: '1',
          name: 'Salary',
          amount: 5000,
          kind: 'INCOME',
        }),
        createTestLine({
          id: '2',
          name: 'Bonus',
          amount: 2000,
          kind: 'INCOME',
        }),
      ];

      const totals = testCalculation(templateLines);

      expect(totals.totalIncome).toBe(7000);
      expect(totals.totalExpenses).toBe(0);
    });

    it('should handle only expense transactions', () => {
      const templateLines: TemplateLine[] = [
        createTestLine({
          id: '1',
          name: 'Rent',
          amount: 1500,
          kind: 'FIXED_EXPENSE',
          description: 'Monthly rent',
        }),
        createTestLine({
          id: '2',
          name: 'Utilities',
          amount: 200,
          kind: 'FIXED_EXPENSE',
          description: 'Utilities',
        }),
      ];

      const totals = testCalculation(templateLines);

      expect(totals.totalIncome).toBe(0);
      expect(totals.totalExpenses).toBe(1700);
    });

    it('should treat SAVINGS_CONTRIBUTION as expense', () => {
      const templateLines: TemplateLine[] = [
        createTestLine({
          id: '1',
          name: 'Emergency Fund',
          amount: 1000,
          kind: 'SAVINGS_CONTRIBUTION',
          description: 'Emergency fund savings',
        }),
        createTestLine({
          id: '2',
          name: 'Retirement',
          amount: 500,
          kind: 'SAVINGS_CONTRIBUTION',
          description: 'Retirement savings',
        }),
      ];

      const totals = testCalculation(templateLines);

      expect(totals.totalIncome).toBe(0);
      expect(totals.totalExpenses).toBe(1500);
    });

    it('should handle decimal amounts correctly', () => {
      const templateLines: TemplateLine[] = [
        createTestLine({
          id: '1',
          name: 'Salary',
          amount: 4999.99,
          kind: 'INCOME',
          description: 'Monthly salary',
        }),
        createTestLine({
          id: '2',
          name: 'Phone',
          amount: 29.95,
          kind: 'FIXED_EXPENSE',
          description: 'Phone bill',
        }),
        createTestLine({
          id: '3',
          name: 'Internet',
          amount: 49.99,
          kind: 'FIXED_EXPENSE',
          description: 'Internet bill',
        }),
      ];

      const totals = testCalculation(templateLines);

      expect(totals.totalIncome).toBeCloseTo(4999.99, 2);
      expect(totals.totalExpenses).toBeCloseTo(79.94, 2);
    });

    it('should handle lowercase kind values (API compatibility)', () => {
      const templateLines = [
        createTestLine({
          id: '1',
          name: 'Salary',
          amount: 5000,
          kind: 'income' as 'INCOME',
        }),
        createTestLine({
          id: '2',
          name: 'Rent',
          amount: 1500,
          kind: 'fixed_expense' as 'FIXED_EXPENSE',
        }),
        createTestLine({
          id: '3',
          name: 'Savings',
          amount: 500,
          kind: 'savings_contribution' as 'SAVINGS_CONTRIBUTION',
        }),
      ];

      const totals = testCalculation(templateLines);

      // With case-insensitive handling, these should work correctly
      expect(totals.totalIncome).toBe(5000);
      expect(totals.totalExpenses).toBe(2000); // 1500 + 500
    });

    it('should handle mixed case kind values (robustness test)', () => {
      const templateLines = [
        createTestLine({
          id: '1',
          name: 'Salary',
          amount: 3000,
          kind: 'Income' as 'INCOME', // Mixed case
        }),
        createTestLine({
          id: '2',
          name: 'Rent',
          amount: 1200,
          kind: 'Fixed_Expense' as 'FIXED_EXPENSE', // Mixed case with underscore
        }),
        createTestLine({
          id: '3',
          name: 'Savings',
          amount: 800,
          kind: 'SAVINGS_contribution' as 'SAVINGS_CONTRIBUTION', // Mixed case
        }),
      ];

      const totals = testCalculation(templateLines);

      // Case-insensitive handling should work for any casing variations
      expect(totals.totalIncome).toBe(3000);
      expect(totals.totalExpenses).toBe(2000); // 1200 + 800
      expect(totals.remainingLivingAllowance).toBe(1000); // 3000 - 2000
    });
  });

  describe('loadTemplateDetails', () => {
    it('should return cached template details when available', async () => {
      const templateId = 'template-1';
      const mockLines = [
        createTestLine({ id: 'line-1', name: 'Salary', amount: 5000 }),
      ];

      // Pre-populate cache
      service.templateDetailsCache.update((cache) => {
        cache.set(templateId, mockLines);
        return new Map(cache);
      });

      const result = await service.loadTemplateDetails(templateId);

      expect(result).toEqual(mockLines);
      expect(mockTemplateApi.getTemplateLines$).not.toHaveBeenCalled();
    });

    it('should load template details from API when not cached', async () => {
      const templateId = 'template-1';
      const mockLines = [
        createTestLine({ id: 'line-1', name: 'Salary', amount: 5000 }),
      ];

      vi.mocked(mockTemplateApi.getTemplateLines$!).mockReturnValue(
        of(mockLines),
      );

      const result = await service.loadTemplateDetails(templateId);

      expect(result).toEqual(mockLines);
      expect(mockTemplateApi.getTemplateLines$).toHaveBeenCalledWith(
        templateId,
      );
      expect(service.templateDetailsCache().get(templateId)).toEqual(mockLines);
    });

    it('should handle API errors gracefully', async () => {
      const templateId = 'template-1';
      const error = new Error('API Error');

      vi.mocked(mockTemplateApi.getTemplateLines$!).mockReturnValue(
        throwError(() => error),
      );

      // Mock console.error to avoid test output pollution
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        /* noop */
      });

      const result = await service.loadTemplateDetails(templateId);

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error loading template details:',
        error,
      );

      consoleSpy.mockRestore();
    });
  });

  describe('loadTemplateTotalsForCurrentTemplates', () => {
    it('should not load if no templates need loading', async () => {
      // Set up templates that already have totals
      const template = createTestTemplate({ id: 'template-1' });
      mockTemplateApi.templatesResource!.value.set([template]);
      service.templateTotalsMap.set({
        'template-1': {
          totalIncome: 1000,
          totalExpenses: 500,
          remainingLivingAllowance: 500,
          loading: false,
        },
      });

      await service.loadTemplateTotalsForCurrentTemplates();

      expect(mockTemplateApi.getTemplateLines$).not.toHaveBeenCalled();
    });

    it('should set loading states and calculate totals for templates needing loading', async () => {
      const template = createTestTemplate({ id: 'template-1' });
      const mockLines = [
        createTestLine({
          id: 'line-1',
          name: 'Salary',
          amount: 5000,
          kind: 'INCOME',
        }),
        createTestLine({
          id: 'line-2',
          name: 'Rent',
          amount: 1500,
          kind: 'FIXED_EXPENSE',
        }),
      ];

      mockTemplateApi.templatesResource!.value.set([template]);
      vi.mocked(mockTemplateApi.getTemplateLines$!).mockReturnValue(
        of(mockLines),
      );

      // Initially should be empty
      expect(service.templateTotalsMap()).toEqual({});

      await service.loadTemplateTotalsForCurrentTemplates();

      const totals = service.templateTotalsMap()['template-1'];
      expect(totals).toBeDefined();
      expect(totals.totalIncome).toBe(5000);
      expect(totals.totalExpenses).toBe(1500);
      expect(totals.remainingLivingAllowance).toBe(3500);
      expect(totals.loading).toBe(false);
    });

    it('should handle errors during loading', async () => {
      const template = createTestTemplate({ id: 'template-1' });
      const error = new Error('API Error');

      mockTemplateApi.templatesResource!.value.set([template]);
      vi.mocked(mockTemplateApi.getTemplateLines$!).mockReturnValue(
        throwError(() => error),
      );

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        /* noop */
      });

      await service.loadTemplateTotalsForCurrentTemplates();

      const totals = service.templateTotalsMap()['template-1'];
      expect(totals).toBeDefined();
      expect(totals.totalIncome).toBe(0);
      expect(totals.totalExpenses).toBe(0);
      expect(totals.remainingLivingAllowance).toBe(0);
      expect(totals.loading).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error loading template details:',
        error,
      );

      consoleSpy.mockRestore();
    });
  });

  describe('selectTemplate', () => {
    it('should update selectedTemplateId signal', () => {
      const templateId = 'template-123';

      expect(service.selectedTemplateId()).toBeNull();

      service.selectTemplate(templateId);

      expect(service.selectedTemplateId()).toBe(templateId);
    });
  });

  describe('computed properties', () => {
    it('should filter templates based on search term', async () => {
      const templates = [
        createTestTemplate({
          id: 'template-1',
          name: 'Budget Standard',
          description: 'Standard budget template',
        }),
        createTestTemplate({
          id: 'template-2',
          name: 'Budget Premium',
          description: 'Premium features',
        }),
        createTestTemplate({
          id: 'template-3',
          name: 'Special Template',
          description: 'Special use case',
        }),
      ];

      mockTemplateApi.templatesResource!.value.set(templates);

      // Test with no search term
      expect(service.filteredTemplates()).toEqual(templates);

      // Test search by name
      service.searchControl.setValue('Premium');
      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 350));
      expect(service.filteredTemplates()).toEqual([templates[1]]);

      // Test search by description
      service.searchControl.setValue('standard');
      await new Promise((resolve) => setTimeout(resolve, 350));
      expect(service.filteredTemplates()).toEqual([templates[0]]);

      // Test case insensitive search
      service.searchControl.setValue('SPECIAL');
      await new Promise((resolve) => setTimeout(resolve, 350));
      expect(service.filteredTemplates()).toEqual([templates[2]]);
    });

    it('should return selected template when available', () => {
      const templates = [
        createTestTemplate({ id: 'template-1', name: 'Template 1' }),
        createTestTemplate({ id: 'template-2', name: 'Template 2' }),
      ];

      mockTemplateApi.templatesResource!.value.set(templates);

      // Initially no selection
      expect(service.selectedTemplate()).toBeNull();

      // Select template
      service.selectTemplate('template-1');
      expect(service.selectedTemplate()).toEqual(templates[0]);

      // Select non-existent template
      service.selectTemplate('non-existent');
      expect(service.selectedTemplate()).toBeNull();
    });
  });
});
