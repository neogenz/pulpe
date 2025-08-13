import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of, throwError } from 'rxjs';
import { type TemplateLine } from '@pulpe/shared';
import { TemplateStore } from './template-store';
import { TemplateTotalsCalculator } from './template-totals-calculator';
import { TemplateApi } from '../../../../../core/template/template-api';

describe('TemplateStore', () => {
  let store: TemplateStore;
  let templateApiMock: Partial<TemplateApi>;
  let totalsCalculatorMock: Partial<TemplateTotalsCalculator>;

  const mockTemplates = [
    {
      id: 'template1',
      userId: 'user1',
      name: 'Standard Month',
      description: 'Default template',
      isDefault: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'template2',
      userId: 'user1',
      name: 'Vacation Month',
      description: 'Template for vacation',
      isDefault: false,
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    },
  ];

  const mockTemplateLines: TemplateLine[] = [
    {
      id: 'line1',
      templateId: 'template1',
      kind: 'income',
      name: 'Salary',
      description: 'Monthly salary',
      amount: 5000,
      recurrence: 'fixed',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'line2',
      templateId: 'template1',
      kind: 'expense',
      name: 'Rent',
      description: 'Monthly rent',
      amount: 1500,
      recurrence: 'fixed',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    // Create a function mock for the observable methods
    const getAll$ = vi.fn().mockReturnValue(of(mockTemplates));
    const getTemplateLines$ = vi.fn().mockReturnValue(of(mockTemplateLines));

    templateApiMock = {
      getAll$,
      getTemplateLines$,
    };
    totalsCalculatorMock = {
      calculateTemplateTotals: vi.fn(),
      calculateBatchTotals: vi.fn().mockReturnValue({
        template1: {
          totalIncome: 5000,
          totalExpenses: 1500,
          totalSavings: 0,
          remainingLivingAllowance: 3500,
          loading: false,
        },
      }),
      createDefaultTotals: vi.fn().mockReturnValue({
        totalIncome: 0,
        totalExpenses: 0,
        totalSavings: 0,
        remainingLivingAllowance: 0,
        loading: false,
      }),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        TemplateStore,
        { provide: TemplateApi, useValue: templateApiMock },
        { provide: TemplateTotalsCalculator, useValue: totalsCalculatorMock },
      ],
    });

    store = TestBed.inject(TemplateStore);
  });

  it('should create', () => {
    expect(store).toBeTruthy();
  });

  describe('template selection', () => {
    it('should select a template', () => {
      store.selectTemplate('template1');
      expect(store.selectedTemplateId()).toBe('template1');
    });

    it('should clear selection', () => {
      store.selectTemplate('template1');
      store.clearSelection();
      expect(store.selectedTemplateId()).toBeNull();
    });

    it('should initialize default selection with default template', async () => {
      // Load templates first
      await store.loadTemplates();

      store.initializeDefaultSelection();
      expect(store.selectedTemplateId()).toBe('template1');
    });

    it('should initialize selection with newest template if no default', async () => {
      const templatesWithoutDefault = mockTemplates.map((t) => ({
        ...t,
        isDefault: false,
      }));
      vi.spyOn(templateApiMock, 'getAll$').mockReturnValue(
        of(templatesWithoutDefault),
      );

      // Recreate store with new mock data
      store = TestBed.inject(TemplateStore);

      // Load templates
      await store.loadTemplates();

      store.initializeDefaultSelection();
      expect(store.selectedTemplateId()).toBe('template2'); // Newest by date
    });

    it('should not change selection if already selected', () => {
      store.selectTemplate('template2');
      store.initializeDefaultSelection();
      expect(store.selectedTemplateId()).toBe('template2');
    });
  });

  describe('template lines loading', () => {
    it('should load and cache template lines', async () => {
      const lines = await store.loadTemplateLines('template1');

      expect(lines).toEqual(mockTemplateLines);
      expect(templateApiMock.getTemplateLines$).toHaveBeenCalledWith(
        'template1',
      );
      expect(store.getCachedTemplateLines('template1')).toEqual(
        mockTemplateLines,
      );
    });

    it('should return cached lines without API call', async () => {
      // First load
      await store.loadTemplateLines('template1');
      vi.clearAllMocks();

      // Second load should use cache
      const lines = await store.loadTemplateLines('template1');

      expect(lines).toEqual(mockTemplateLines);
      expect(templateApiMock.getTemplateLines$).not.toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      vi.spyOn(templateApiMock, 'getTemplateLines$').mockReturnValue(
        throwError(() => new Error('API Error')),
      );

      const lines = await store.loadTemplateLines('template1');

      expect(lines).toEqual([]);
    });
  });

  describe('template totals loading', () => {
    it('should load totals for multiple templates', async () => {
      await store.loadTemplateTotals(['template1', 'template2']);

      expect(templateApiMock.getTemplateLines$).toHaveBeenCalledTimes(2);
      expect(totalsCalculatorMock.calculateBatchTotals).toHaveBeenCalled();
    });

    it('should skip already loaded templates', async () => {
      // Pre-load template1 totals
      await store.loadTemplateTotals(['template1']);
      vi.clearAllMocks();

      await store.loadTemplateTotals(['template1', 'template2']);

      // Should only load template2
      expect(templateApiMock.getTemplateLines$).toHaveBeenCalledTimes(1);
      expect(templateApiMock.getTemplateLines$).toHaveBeenCalledWith(
        'template2',
      );
    });

    it('should set loading states while loading', () => {
      vi.spyOn(totalsCalculatorMock, 'createDefaultTotals').mockReturnValue({
        totalIncome: 0,
        totalExpenses: 0,
        totalSavings: 0,
        remainingLivingAllowance: 0,
        loading: true,
      });

      // Start loading (don't await)
      store.loadTemplateTotals(['template1']);

      // Check loading state is set immediately
      const totals = store.templateTotalsMap();
      expect(totals['template1']?.loading).toBe(true);
    });
  });

  describe('cache management', () => {
    it('should clear all caches', async () => {
      // Load some data
      await store.loadTemplateLines('template1');
      await store.loadTemplateTotals(['template1']);

      // Clear caches
      store.clearCaches();

      expect(store.getCachedTemplateLines('template1')).toBeNull();
      expect(store.templateTotalsMap()).toEqual({});
    });

    it('should invalidate specific template', async () => {
      // Load data for multiple templates
      await store.loadTemplateLines('template1');
      await store.loadTemplateLines('template2');
      await store.loadTemplateTotals(['template1', 'template2']);

      // Invalidate only template1
      store.invalidateTemplate('template1');

      expect(store.getCachedTemplateLines('template1')).toBeNull();
      expect(store.getCachedTemplateLines('template2')).not.toBeNull();
      expect(store.templateTotalsMap()['template1']).toBeUndefined();
      expect(store.templateTotalsMap()['template2']).toBeDefined();
    });
  });

  describe('computed values', () => {
    it('should compute selected template', async () => {
      // Load templates first
      await store.loadTemplates();

      store.selectTemplate('template1');
      const selected = store.selectedTemplate();

      expect(selected).toEqual(mockTemplates[0]);
    });

    it('should return null when no template selected', () => {
      const selected = store.selectedTemplate();
      expect(selected).toBeNull();
    });

    it('should compute sorted templates with default first', async () => {
      // Load templates first
      await store.loadTemplates();

      const sorted = store.sortedTemplates();

      expect(sorted[0].isDefault).toBe(true);
      expect(sorted[0].id).toBe('template1');
    });
  });
});
