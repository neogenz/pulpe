import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { BudgetTemplatesState } from './budget-templates-state';
import { BudgetTemplatesApi } from './budget-templates-api';
import type { BudgetTemplate, BudgetTemplateCreate } from '@pulpe/shared';

describe('BudgetTemplatesState', () => {
  let state: BudgetTemplatesState;
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
    mockApi = {
      getAll$: vi
        .fn()
        .mockReturnValue(of({ data: mockTemplates, success: true })),
      create$: vi.fn(),
      update$: vi.fn(),
      delete$: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        BudgetTemplatesState,
        { provide: BudgetTemplatesApi, useValue: mockApi },
      ],
    });

    state = TestBed.inject(BudgetTemplatesState);
  });

  describe('Initialization', () => {
    it('should initialize with correct MAX_TEMPLATES constant', () => {
      expect(state.MAX_TEMPLATES).toBe(5);
    });

    it('should initialize with null business error', () => {
      expect(state.businessError()).toBeNull();
    });

    it('should initialize with null selected template', () => {
      expect(state.selectedTemplate()).toBeNull();
    });
  });

  describe('Template Count and Limit Management', () => {
    it('should compute template count correctly', async () => {
      // Wait for resource to load
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(state.templateCount()).toBe(2);
    });

    it('should compute canCreateMore correctly when under limit', async () => {
      // Wait for resource to load
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(state.canCreateMore()).toBe(true);
      expect(state.remainingTemplates()).toBe(3);
    });

    it('should compute canCreateMore as false when at limit', async () => {
      const fiveTemplates = Array.from({ length: 5 }, (_, i) => ({
        ...mockTemplates[0],
        id: `template-${i + 1}`,
        name: `Template ${i + 1}`,
        isDefault: i === 0,
      }));

      mockApi.getAll$ = vi
        .fn()
        .mockReturnValue(of({ data: fiveTemplates, success: true }));

      // Reinitialize state with new mock data
      state = TestBed.inject(BudgetTemplatesState);

      // Wait for resource to load
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(state.templateCount()).toBe(5);
      expect(state.canCreateMore()).toBe(false);
      expect(state.remainingTemplates()).toBe(0);
    });
  });

  describe('Default Template Management', () => {
    it('should identify current default template', async () => {
      // Wait for resource to load
      await new Promise((resolve) => setTimeout(resolve, 100));

      const defaultTemplate = state.currentDefaultTemplate();
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

      state = TestBed.inject(BudgetTemplatesState);

      // Wait for resource to load
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(state.currentDefaultTemplate()).toBeNull();
      expect(state.hasDefaultTemplate()).toBe(false);
    });
  });

  describe('Template Creation Validation', () => {
    it('should validate creation when under limit', async () => {
      // Wait for resource to load
      await new Promise((resolve) => setTimeout(resolve, 100));

      const canCreate = state.validateCanCreate();

      expect(canCreate).toBe(true);
      expect(state.businessError()).toBeNull();
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

      state = TestBed.inject(BudgetTemplatesState);

      // Wait for resource to load
      await new Promise((resolve) => setTimeout(resolve, 100));

      const canCreate = state.validateCanCreate();

      expect(canCreate).toBe(false);
      expect(state.businessError()).toBe(
        'Vous avez atteint la limite de 5 modèles',
      );
    });

    it('should validate default template switching', () => {
      expect(state.validateDefaultTemplate(true)).toBe(true);
      expect(state.validateDefaultTemplate(false)).toBe(true);
    });
  });

  describe('Template Creation with Default Switching', () => {
    it('should create template and switch default when needed', async () => {
      const newTemplate: BudgetTemplateCreate = {
        name: 'New Default Template',
        description: 'This will be default',
        isDefault: true,
      };

      const createdTemplate: BudgetTemplate = {
        id: 'template-3',
        ...newTemplate,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockApi.update$ = vi.fn().mockReturnValue(
        of({
          data: { ...mockTemplates[0], isDefault: false },
          success: true,
        }),
      );
      mockApi.create$ = vi
        .fn()
        .mockReturnValue(of({ data: createdTemplate, success: true }));

      // Wait for initial load
      await new Promise((resolve) => setTimeout(resolve, 100));

      await state.addTemplate(newTemplate);

      expect(mockApi.update$).toHaveBeenCalledWith('template-1', {
        ...mockTemplates[0],
        isDefault: false,
      });
      expect(mockApi.create$).toHaveBeenCalledWith(newTemplate);
    });

    it('should create non-default template without switching', async () => {
      const newTemplate: BudgetTemplateCreate = {
        name: 'Regular Template',
        description: 'Non-default template',
        isDefault: false,
      };

      const createdTemplate: BudgetTemplate = {
        id: 'template-3',
        ...newTemplate,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockApi.create$ = vi
        .fn()
        .mockReturnValue(of({ data: createdTemplate, success: true }));

      // Wait for initial load
      await new Promise((resolve) => setTimeout(resolve, 100));

      await state.addTemplate(newTemplate);

      expect(mockApi.update$).not.toHaveBeenCalled();
      expect(mockApi.create$).toHaveBeenCalledWith(newTemplate);
    });

    it('should handle error when switching default fails', async () => {
      const newTemplate: BudgetTemplateCreate = {
        name: 'New Default Template',
        description: 'This will fail',
        isDefault: true,
      };

      mockApi.update$ = vi
        .fn()
        .mockReturnValue(throwError(() => new Error('Update failed')));

      // Wait for initial load
      await new Promise((resolve) => setTimeout(resolve, 100));

      await expect(state.addTemplate(newTemplate)).rejects.toThrow(
        'Update failed',
      );
      expect(mockApi.create$).not.toHaveBeenCalled();
    });

    it('should handle error when creation fails after default switch', async () => {
      const newTemplate: BudgetTemplateCreate = {
        name: 'New Default Template',
        description: 'Creation will fail',
        isDefault: true,
      };

      mockApi.update$ = vi.fn().mockReturnValue(
        of({
          data: { ...mockTemplates[0], isDefault: false },
          success: true,
        }),
      );
      mockApi.create$ = vi
        .fn()
        .mockReturnValue(throwError(() => new Error('Creation failed')));

      // Wait for initial load
      await new Promise((resolve) => setTimeout(resolve, 100));

      await expect(state.addTemplate(newTemplate)).rejects.toThrow();
      expect(state.businessError()).toBe(
        'Erreur lors de la création du modèle',
      );
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

      state = TestBed.inject(BudgetTemplatesState);

      // Wait for resource to load
      await new Promise((resolve) => setTimeout(resolve, 100));

      const newTemplate: BudgetTemplateCreate = {
        name: 'Exceeding Template',
        description: 'This should fail',
        isDefault: false,
      };

      await expect(state.addTemplate(newTemplate)).rejects.toThrow(
        'Vous avez atteint la limite de 5 modèles',
      );
      expect(mockApi.create$).not.toHaveBeenCalled();
    });
  });

  describe('Optimistic Updates', () => {
    it('should apply optimistic update during creation', async () => {
      const newTemplate: BudgetTemplateCreate = {
        name: 'Optimistic Template',
        description: 'Testing optimistic update',
        isDefault: false,
      };

      const createdTemplate: BudgetTemplate = {
        id: 'template-3',
        ...newTemplate,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      let createResolve: (value: unknown) => void;
      const createPromise = new Promise((resolve) => {
        createResolve = resolve;
      });

      mockApi.create$ = vi.fn().mockReturnValue({
        subscribe: (callbacks: { next: (value: unknown) => void }) => {
          createPromise.then((value) => callbacks.next(value));
          return {
            unsubscribe: () => {
              /* noop */
            },
          };
        },
      });

      // Wait for initial load
      await new Promise((resolve) => setTimeout(resolve, 100));

      const addPromise = state.addTemplate(newTemplate);

      // Check optimistic update - should have temporary template
      const templates = state.templatesData.value();
      const tempTemplate = templates?.find((t) => t.id.startsWith('temp-'));
      expect(tempTemplate).toBeTruthy();
      expect(tempTemplate?.name).toBe('Optimistic Template');

      // Resolve the creation
      createResolve!({ data: createdTemplate, success: true });
      await addPromise;

      // Check final state - temporary should be replaced
      const finalTemplates = state.templatesData.value();
      expect(finalTemplates?.find((t) => t.id.startsWith('temp-'))).toBeFalsy();
      expect(finalTemplates?.find((t) => t.id === 'template-3')).toBeTruthy();
    });

    it('should rollback optimistic update on failure', async () => {
      const newTemplate: BudgetTemplateCreate = {
        name: 'Failing Template',
        description: 'This will fail',
        isDefault: false,
      };

      mockApi.create$ = vi
        .fn()
        .mockReturnValue(throwError(() => new Error('Creation failed')));

      // Wait for initial load
      await new Promise((resolve) => setTimeout(resolve, 100));

      const initialCount = state.templateCount();

      try {
        await state.addTemplate(newTemplate);
      } catch {
        // Expected error
      }

      // Template count should be back to original
      expect(state.templateCount()).toBe(initialCount);
      expect(
        state.templatesData.value()?.find((t) => t.id.startsWith('temp-')),
      ).toBeFalsy();
    });
  });

  describe('Template Selection', () => {
    it('should select template by id', async () => {
      // Wait for initial load
      await new Promise((resolve) => setTimeout(resolve, 100));

      state.selectTemplate('template-2');

      const selected = state.selectedTemplate();
      expect(selected).toBeTruthy();
      expect(selected?.id).toBe('template-2');
      expect(selected?.name).toBe('Template 2');
    });

    it('should set null when selecting non-existent template', async () => {
      // Wait for initial load
      await new Promise((resolve) => setTimeout(resolve, 100));

      state.selectTemplate('non-existent');
      expect(state.selectedTemplate()).toBeNull();
    });
  });

  describe('Template Deletion', () => {
    it('should delete template optimistically', async () => {
      mockApi.delete$ = vi.fn().mockReturnValue(of({ success: true }));

      // Wait for initial load
      await new Promise((resolve) => setTimeout(resolve, 100));

      const initialCount = state.templateCount();

      await state.deleteTemplate('template-2');

      expect(state.templateCount()).toBe(initialCount - 1);
      expect(
        state.templatesData.value()?.find((t) => t.id === 'template-2'),
      ).toBeFalsy();
      expect(mockApi.delete$).toHaveBeenCalledWith('template-2');
    });

    it('should rollback deletion on error', async () => {
      mockApi.delete$ = vi
        .fn()
        .mockReturnValue(throwError(() => new Error('Deletion failed')));

      // Wait for initial load
      await new Promise((resolve) => setTimeout(resolve, 100));

      const initialTemplates = state.templatesData.value();

      await expect(state.deleteTemplate('template-2')).rejects.toThrow(
        'Deletion failed',
      );

      // Should be rolled back
      expect(state.templatesData.value()).toEqual(initialTemplates);
    });
  });

  describe('Data Refresh', () => {
    it('should refresh data when not loading', () => {
      const reloadSpy = vi.spyOn(state.templatesData, 'reload');

      state.refreshData();

      expect(reloadSpy).toHaveBeenCalled();
    });

    it('should not refresh when already loading', async () => {
      // Force loading state by creating a new delayed observable
      mockApi.getAll$ = vi
        .fn()
        .mockReturnValue(
          new Promise((resolve) =>
            setTimeout(
              () => resolve({ data: mockTemplates, success: true }),
              1000,
            ),
          ),
        );

      state = TestBed.inject(BudgetTemplatesState);

      const reloadSpy = vi.spyOn(state.templatesData, 'reload');

      // Immediately try to refresh while initial load is happening
      state.refreshData();

      expect(reloadSpy).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors during initial load', async () => {
      mockApi.getAll$ = vi
        .fn()
        .mockReturnValue(
          throwError(() => new Error('Failed to load templates')),
        );

      state = TestBed.inject(BudgetTemplatesState);

      // Wait for resource to attempt load
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(state.templatesData.error()).toBeTruthy();
      expect(state.templateCount()).toBe(0);
      expect(state.hasTemplates()).toBe(false);
    });

    it('should clear business error when validation passes', async () => {
      const fiveTemplates = Array.from({ length: 5 }, (_, i) => ({
        ...mockTemplates[0],
        id: `template-${i + 1}`,
        name: `Template ${i + 1}`,
      }));

      mockApi.getAll$ = vi
        .fn()
        .mockReturnValue(of({ data: fiveTemplates, success: true }));

      state = TestBed.inject(BudgetTemplatesState);

      // Wait for resource to load
      await new Promise((resolve) => setTimeout(resolve, 100));

      // First validation should fail
      state.validateCanCreate();
      expect(state.businessError()).toBeTruthy();

      // Simulate template deletion
      mockApi.getAll$ = vi
        .fn()
        .mockReturnValue(of({ data: mockTemplates, success: true }));
      state.refreshData();

      // Wait for refresh
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Now validation should pass and clear error
      state.validateCanCreate();
      expect(state.businessError()).toBeNull();
    });
  });

  describe('Loading States', () => {
    it('should compute loading state correctly', () => {
      // Initial state
      expect(state.isLoading()).toBe(true);

      // After loading completes
      setTimeout(() => {
        expect(state.isLoading()).toBe(false);
      }, 100);
    });

    it('should show loading during reload', async () => {
      // Wait for initial load
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(state.isLoading()).toBe(false);

      // Trigger reload with delayed response
      mockApi.getAll$ = vi
        .fn()
        .mockReturnValue(
          new Promise((resolve) =>
            setTimeout(
              () => resolve({ data: mockTemplates, success: true }),
              100,
            ),
          ),
        );

      state.refreshData();

      // Should be loading immediately after refresh
      expect(state.isLoading()).toBe(true);
    });
  });
});
