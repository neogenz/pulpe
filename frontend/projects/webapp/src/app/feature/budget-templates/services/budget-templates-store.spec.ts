import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { BudgetTemplatesStore } from './budget-templates-store';
import { BudgetTemplatesApi } from '@core/budget-template/budget-templates-api';
import type { BudgetTemplate, BudgetTemplateCreate } from 'pulpe-shared';

const mockCache = {
  get: vi.fn().mockReturnValue(null),
  set: vi.fn(),
  has: vi.fn().mockReturnValue(false),
  invalidate: vi.fn(),
  deduplicate: vi.fn((_key: string[], fn: () => Promise<unknown>) => fn()),
  prefetch: vi.fn((_key: string[], fn: () => Promise<unknown>) => fn()),
  clear: vi.fn(),
  clearDirty: vi.fn(),
  version: signal(0),
};

describe('BudgetTemplatesStore', () => {
  let store: BudgetTemplatesStore;
  let mockApi: Partial<BudgetTemplatesApi>;

  const mockTemplates: BudgetTemplate[] = [
    {
      id: 'template-1',
      name: 'Template 1',
      description: 'First template',
      isDefault: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: 'template-2',
      name: 'Template 2',
      description: 'Second template',
      isDefault: false,
      createdAt: '2024-01-02T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
    },
  ];

  beforeEach(() => {
    mockCache.get.mockReturnValue(null);
    mockCache.set.mockClear();
    mockCache.invalidate.mockClear();
    mockCache.deduplicate.mockImplementation(
      (_key: string[], fn: () => Promise<unknown>) => fn(),
    );

    mockApi = {
      getAll$: vi
        .fn()
        .mockReturnValue(of({ data: mockTemplates, success: true })),
      create$: vi.fn(),
      update$: vi.fn(),
      delete$: vi.fn(),
      checkUsage$: vi.fn(),
      cache: mockCache as unknown as BudgetTemplatesApi['cache'],
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
        BudgetTemplatesStore,
        { provide: BudgetTemplatesApi, useValue: mockApi },
      ],
    });

    store = TestBed.inject(BudgetTemplatesStore);
  });

  describe('Initialization', () => {
    it('should initialize with correct MAX_TEMPLATES constant', () => {
      expect(store.MAX_TEMPLATES).toBe(5);
    });

    it('should initialize with null selected template', () => {
      expect(store.selectedTemplate()).toBeNull();
    });
  });

  describe('Template Count and Limit Management', () => {
    it('should compute template count correctly', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(store.templateCount()).toBe(2);
    });

    it('should compute isTemplateLimitReached correctly when under limit', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(store.isTemplateLimitReached()).toBe(false);
      expect(store.remainingTemplates()).toBe(3);
    });

    it('should compute isTemplateLimitReached as true when at limit', async () => {
      const fiveTemplates = Array.from({ length: 5 }, (_, i) => ({
        ...mockTemplates[0],
        id: `template-${i + 1}`,
        name: `Template ${i + 1}`,
        isDefault: i === 0,
      }));

      mockApi.getAll$ = vi
        .fn()
        .mockReturnValue(of({ data: fiveTemplates, success: true }));

      store = TestBed.inject(BudgetTemplatesStore);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(store.templateCount()).toBe(5);
      expect(store.isTemplateLimitReached()).toBe(true);
      expect(store.remainingTemplates()).toBe(0);
    });
  });

  describe('Default Template Management', () => {
    it('should identify current default template', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      const defaultTemplate = store.defaultBudgetTemplate();
      expect(defaultTemplate).toBeTruthy();
      expect(defaultTemplate?.id).toBe('template-1');
      expect(defaultTemplate?.isDefault).toBe(true);
    });

    it('should handle no default template scenario', async () => {
      const noDefaultTemplates = mockTemplates.map((t) => ({
        ...t,
        isDefault: false,
      }));

      mockApi.getAll$ = vi
        .fn()
        .mockReturnValue(of({ data: noDefaultTemplates, success: true }));

      store = TestBed.inject(BudgetTemplatesStore);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(store.defaultBudgetTemplate()).toBeNull();
    });
  });

  describe('Template Creation Validation', () => {
    it('should allow creation when under limit', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(store.isTemplateLimitReached()).toBe(false);
    });

    it('should prevent creation when at limit', async () => {
      const fiveTemplates = Array.from({ length: 5 }, (_, i) => ({
        ...mockTemplates[0],
        id: `template-${i + 1}`,
        name: `Template ${i + 1}`,
      }));

      mockApi.getAll$ = vi
        .fn()
        .mockReturnValue(of({ data: fiveTemplates, success: true }));

      store = TestBed.inject(BudgetTemplatesStore);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(store.isTemplateLimitReached()).toBe(true);
    });
  });

  describe('Template Creation with Default Switching', () => {
    it('should create template and switch default when needed', async () => {
      const newTemplate: BudgetTemplateCreate = {
        name: 'New Default Template',
        description: 'This will be default',
        isDefault: true,
        lines: [],
      };

      const createdTemplate: BudgetTemplate = {
        id: 'template-3',
        ...newTemplate,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockApi.create$ = vi
        .fn()
        .mockReturnValue(
          of({ data: { template: createdTemplate, lines: [] }, success: true }),
        );

      await new Promise((resolve) => setTimeout(resolve, 100));

      await store.addTemplate(newTemplate);

      expect(mockApi.update$).not.toHaveBeenCalled();
      expect(mockApi.create$).toHaveBeenCalledWith(newTemplate);
    });

    it('should create non-default template without switching', async () => {
      const newTemplate: BudgetTemplateCreate = {
        name: 'Regular Template',
        description: 'Non-default template',
        isDefault: false,
        lines: [],
      };

      const createdTemplate: BudgetTemplate = {
        id: 'template-3',
        ...newTemplate,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockApi.create$ = vi
        .fn()
        .mockReturnValue(
          of({ data: { template: createdTemplate, lines: [] }, success: true }),
        );

      await new Promise((resolve) => setTimeout(resolve, 100));

      await store.addTemplate(newTemplate);

      expect(mockApi.update$).not.toHaveBeenCalled();
      expect(mockApi.create$).toHaveBeenCalledWith(newTemplate);
    });

    it('should throw when creation fails', async () => {
      const newTemplate: BudgetTemplateCreate = {
        name: 'New Default Template',
        description: 'This will fail',
        isDefault: true,
        lines: [],
      };

      mockApi.create$ = vi
        .fn()
        .mockReturnValue(throwError(() => new Error('Creation failed')));

      await new Promise((resolve) => setTimeout(resolve, 100));

      await expect(store.addTemplate(newTemplate)).rejects.toThrow();
    });

    it('should not modify state when creation fails', async () => {
      const newTemplate: BudgetTemplateCreate = {
        name: 'New Default Template',
        description: 'Creation will fail',
        isDefault: true,
        lines: [],
      };

      mockApi.create$ = vi
        .fn()
        .mockReturnValue(throwError(() => new Error('Creation failed')));

      await new Promise((resolve) => setTimeout(resolve, 100));

      const initialCount = store.templateCount();

      try {
        await store.addTemplate(newTemplate);
      } catch {
        // Expected — addTemplate now throws on failure
      }

      expect(store.templateCount()).toBe(initialCount);
    });

    it('should throw error when trying to create beyond limit', async () => {
      const fiveTemplates = Array.from({ length: 5 }, (_, i) => ({
        ...mockTemplates[0],
        id: `template-${i + 1}`,
        name: `Template ${i + 1}`,
      }));

      mockApi.getAll$ = vi
        .fn()
        .mockReturnValue(of({ data: fiveTemplates, success: true }));

      store = TestBed.inject(BudgetTemplatesStore);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const newTemplate: BudgetTemplateCreate = {
        name: 'Exceeding Template',
        description: 'This should fail',
        isDefault: false,
        lines: [],
      };

      await expect(store.addTemplate(newTemplate)).rejects.toThrow(
        'Template limit reached',
      );
      expect(mockApi.create$).not.toHaveBeenCalled();
    });
  });

  describe('Template Creation', () => {
    it('should add template to state only after successful API response', async () => {
      const newTemplate: BudgetTemplateCreate = {
        name: 'New Template',
        description: 'Testing creation',
        isDefault: false,
        lines: [],
      };

      const createdTemplate: BudgetTemplate = {
        id: 'template-3',
        ...newTemplate,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockApi.create$ = vi
        .fn()
        .mockReturnValue(
          of({ data: { template: createdTemplate, lines: [] }, success: true }),
        );

      await new Promise((resolve) => setTimeout(resolve, 100));

      const initialCount = store.templateCount();

      await store.addTemplate(newTemplate);

      expect(store.templateCount()).toBe(initialCount + 1);
      expect(
        store.budgetTemplates.value()?.find((t) => t.id === 'template-3'),
      ).toBeTruthy();
    });

    it('should pre-populate detail cache after creation', async () => {
      const createdTemplate: BudgetTemplate = {
        id: 'template-3',
        name: 'New Template',
        description: 'Testing cache',
        isDefault: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const lines = [{ id: 'line-1', name: 'Salary' }];

      mockApi.create$ = vi.fn().mockReturnValue(
        of({
          data: { template: createdTemplate, lines },
          success: true,
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      await store.addTemplate({
        name: 'New Template',
        description: 'Testing cache',
        isDefault: false,
        lines: [],
      });

      expect(mockCache.set).toHaveBeenCalledWith(
        ['templates', 'details', createdTemplate.id],
        { template: createdTemplate, transactions: lines },
      );
    });

    it('should not modify state on creation failure', async () => {
      const newTemplate: BudgetTemplateCreate = {
        name: 'Failing Template',
        description: 'This will fail',
        isDefault: false,
        lines: [],
      };

      mockApi.create$ = vi
        .fn()
        .mockReturnValue(throwError(() => new Error('Creation failed')));

      await new Promise((resolve) => setTimeout(resolve, 100));

      const initialCount = store.templateCount();

      try {
        await store.addTemplate(newTemplate);
      } catch {
        // Expected — addTemplate now throws on failure
      }

      expect(store.templateCount()).toBe(initialCount);
    });
  });

  describe('Template Selection', () => {
    it('should select template by id', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      store.selectTemplate('template-2');

      const selected = store.selectedTemplate();
      expect(selected).toBeTruthy();
      expect(selected?.id).toBe('template-2');
      expect(selected?.name).toBe('Template 2');
    });

    it('should set null when selecting non-existent template', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      store.selectTemplate('non-existent');
      expect(store.selectedTemplate()).toBeNull();
    });
  });

  describe('Template Deletion', () => {
    it('should delete template via mutation with optimistic update', async () => {
      mockApi.delete$ = vi
        .fn()
        .mockReturnValue(of({ success: true, data: null }));

      await new Promise((resolve) => setTimeout(resolve, 100));

      const initialCount = store.templateCount();

      store.deleteTemplate('template-2');

      // Optimistic update happens synchronously via onMutate
      expect(store.templateCount()).toBe(initialCount - 1);
      expect(
        store.budgetTemplates.value()?.find((t) => t.id === 'template-2'),
      ).toBeFalsy();

      // Wait for mutation to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockApi.delete$).toHaveBeenCalledWith('template-2');
    });
  });

  describe('checkUsage', () => {
    it('should call the API and cache the response on first call', async () => {
      const usageData = {
        isUsed: true,
        budgetCount: 1,
        budgets: [
          { id: 'budget-1', month: 4, year: 2026, description: 'April' },
        ],
      };
      mockApi.checkUsage$ = vi
        .fn()
        .mockReturnValue(of({ success: true, data: usageData }));

      const result = await store.checkUsage('template-1');

      expect(result).toEqual(usageData);
      expect(mockApi.checkUsage$).toHaveBeenCalledTimes(1);
      expect(mockCache.set).toHaveBeenCalledWith(
        ['templates', 'usage', 'template-1'],
        usageData,
      );
    });

    it('should return fresh cached data without calling the API', async () => {
      const usageData = {
        isUsed: false,
        budgetCount: 0,
        budgets: [],
      };
      mockCache.get.mockReturnValue({ data: usageData, fresh: true });
      mockApi.checkUsage$ = vi.fn();

      const result = await store.checkUsage('template-1');

      expect(result).toEqual(usageData);
      expect(mockApi.checkUsage$).not.toHaveBeenCalled();
    });

    it('should return stale data immediately and refetch in background (SWR)', async () => {
      const staleData = { isUsed: false, budgetCount: 0, budgets: [] };
      const freshData = {
        isUsed: true,
        budgetCount: 1,
        budgets: [
          { id: 'budget-1', month: 4, year: 2026, description: 'April' },
        ],
      };
      mockCache.get.mockReturnValue({ data: staleData, fresh: false });
      let resolveFetch: (value: unknown) => void = () => undefined;
      const pending = new Promise((resolve) => {
        resolveFetch = resolve;
      });
      mockApi.checkUsage$ = vi.fn().mockReturnValue({ subscribe: vi.fn() });
      mockCache.deduplicate.mockImplementation(
        (_key: string[], fn: () => Promise<unknown>) => {
          fn().catch(() => undefined);
          return pending;
        },
      );

      const result = await store.checkUsage('template-1');

      expect(result).toEqual(staleData);
      resolveFetch(freshData);
    });
  });

  describe('Data Refresh', () => {
    it('should refresh data', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      const reloadSpy = vi.spyOn(store.budgetTemplates, 'reload');

      store.refreshData();

      expect(reloadSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors during initial load', async () => {
      mockApi.getAll$ = vi
        .fn()
        .mockReturnValue(
          throwError(() => new Error('Failed to load templates')),
        );

      store = TestBed.inject(BudgetTemplatesStore);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(store.budgetTemplates.error()).toBeTruthy();
      expect(store.budgetTemplates.status()).toBe('error');
    });
  });
});
