import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ComponentFixture } from '@angular/core/testing';
import {
  provideZonelessChangeDetection,
  signal,
  NO_ERRORS_SCHEMA,
} from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
  MatDialog,
} from '@angular/material/dialog';
import { provideAnimations } from '@angular/platform-browser/animations';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import {
  MAT_DATE_FNS_FORMATS,
  MatDateFnsModule,
  provideDateFnsAdapter,
} from '@angular/material-date-fns-adapter';
import { FormControl } from '@angular/forms';
import { CreateBudgetDialogComponent } from './budget-creation-dialog';
import { TemplateSelectionService } from './services/template-selection.service';
import { TemplateApi } from '../../../core/template/template-api';
import {
  BudgetApi,
  type BudgetApiError,
} from '../../../core/budget/budget-api';
import { BudgetCreationFormState } from './budget-creation-form-state';
import { type BudgetTemplate, type TemplateLine } from '@pulpe/shared';
import { of, throwError } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { fr } from 'date-fns/locale';

describe('CreateBudgetDialogComponent', () => {
  let component: CreateBudgetDialogComponent;
  let fixture: ComponentFixture<CreateBudgetDialogComponent>;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockTemplateApi: {
    templatesResource: {
      value: ReturnType<typeof vi.fn>;
      isLoading: ReturnType<typeof vi.fn>;
      error: ReturnType<typeof vi.fn>;
      reload: ReturnType<typeof vi.fn>;
    };
    getTemplateLines$: ReturnType<typeof vi.fn>;
  };
  let mockTemplateSelectionService: Partial<TemplateSelectionService>;
  let mockSelectedTemplateSignal: ReturnType<
    typeof signal<BudgetTemplate | null>
  >;
  let mockDialog: { open: ReturnType<typeof vi.fn> };
  let mockBudgetApi: {
    createBudget$: ReturnType<typeof vi.fn>;
  };
  let mockSnackBar: {
    open: ReturnType<typeof vi.fn>;
  };

  // Mock data
  const mockTemplates: BudgetTemplate[] = [
    {
      id: 'template-1',
      name: 'Template 1',
      description: 'First template',
      isDefault: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'template-2',
      name: 'Template 2',
      description: 'Second template',
      isDefault: false,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  ];

  const mockTemplateLines: Record<string, TemplateLine[]> = {
    'template-1': [
      {
        id: 'line-1',
        templateId: 'template-1',
        name: 'Salary',
        amount: 5000,
        kind: 'INCOME',
        recurrence: 'fixed',
        description: 'Monthly salary',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'line-2',
        templateId: 'template-1',
        name: 'Rent',
        amount: 1500,
        kind: 'FIXED_EXPENSE',
        recurrence: 'fixed',
        description: 'Monthly rent',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ],
    'template-2': [
      {
        id: 'line-3',
        templateId: 'template-2',
        name: 'Income',
        amount: 8000,
        kind: 'INCOME',
        recurrence: 'fixed',
        description: 'Income',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'line-4',
        templateId: 'template-2',
        name: 'Expenses',
        amount: 2000,
        kind: 'FIXED_EXPENSE',
        recurrence: 'fixed',
        description: 'Expenses',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'line-5',
        templateId: 'template-2',
        name: 'Savings',
        amount: 500,
        kind: 'SAVINGS_CONTRIBUTION',
        recurrence: 'fixed',
        description: 'Savings',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ],
  };

  beforeEach(async () => {
    // Create mocks
    mockDialogRef = {
      close: vi.fn(),
    };

    mockDialog = {
      open: vi.fn(),
    };

    mockBudgetApi = {
      createBudget$: vi.fn(),
    };

    mockSnackBar = {
      open: vi.fn(),
    };

    mockTemplateApi = {
      templatesResource: {
        value: vi.fn().mockReturnValue(mockTemplates),
        isLoading: vi.fn().mockReturnValue(false),
        error: vi.fn().mockReturnValue(null),
        reload: vi.fn(),
      },
      getTemplateLines$: vi.fn((templateId: string) =>
        of(mockTemplateLines[templateId] || []),
      ),
    };

    const searchControl = new FormControl<string>('', { nonNullable: true });
    mockSelectedTemplateSignal = signal<BudgetTemplate | null>(null);

    mockTemplateSelectionService = {
      searchControl: searchControl,
      searchTerm: signal(''),
      selectedTemplateId: signal(null),
      filteredTemplates: signal(mockTemplates),
      selectedTemplate: mockSelectedTemplateSignal,
      templateDetailsCache: signal(new Map()),
      selectTemplate: vi.fn(),
      clearSelectedTemplate: vi.fn(),
      loadTemplateDetails: vi.fn((templateId: string) =>
        Promise.resolve(mockTemplateLines[templateId] || []),
      ) as unknown as TemplateSelectionService['loadTemplateDetails'],
      calculateTemplateTotals: vi.fn((lines: TemplateLine[]) => {
        const totalIncome = lines
          .filter((line) => line.kind === 'INCOME')
          .reduce((sum, line) => sum + line.amount, 0);
        const totalExpenses = lines
          .filter(
            (line) =>
              line.kind === 'FIXED_EXPENSE' ||
              line.kind === 'SAVINGS_CONTRIBUTION',
          )
          .reduce((sum, line) => sum + line.amount, 0);
        const remainingLivingAllowance = totalIncome - totalExpenses;
        return { totalIncome, totalExpenses, remainingLivingAllowance };
      }),
    } as Partial<TemplateSelectionService>;

    // Configure TestBed
    await TestBed.configureTestingModule({
      imports: [CreateBudgetDialogComponent, MatDateFnsModule],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimations(),
        provideDateFnsAdapter(MAT_DATE_FNS_FORMATS),
        { provide: MAT_DATE_LOCALE, useValue: fr },
        BudgetCreationFormState,
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: {} },
        { provide: MatDialog, useValue: mockDialog },
        { provide: TemplateApi, useValue: mockTemplateApi },
        { provide: BudgetApi, useValue: mockBudgetApi },
        { provide: MatSnackBar, useValue: mockSnackBar },
        {
          provide: TemplateSelectionService,
          useValue: mockTemplateSelectionService,
        },
      ],
    })
      .overrideComponent(CreateBudgetDialogComponent, {
        set: { schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(CreateBudgetDialogComponent);
    component = fixture.componentInstance;
  });

  describe('Component Initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize form with current month/year', () => {
      const monthYearControl = component.budgetForm.get('monthYear');
      expect(monthYearControl).toBeTruthy();
      expect(monthYearControl?.value).toBeInstanceOf(Date);
    });

    it('should initialize with empty template totals', () => {
      expect(component.templateTotals()).toEqual({});
    });
  });

  describe('Template Totals Loading', () => {
    it('should load template totals when templates are displayed', async () => {
      // Direct test - manually call the private method and verify state change
      expect(component.templateTotals()).toEqual({});

      await component['loadTemplateTotal']('template-1');

      // Verify the state was updated
      const totals = component.templateTotals();
      expect(totals['template-1']).toBeDefined();
      expect(totals['template-1'].totalIncome).toBe(5000);
      expect(totals['template-1'].totalExpenses).toBe(1500);
      expect(totals['template-1'].loading).toBe(false);
    });

    it('should calculate and store correct totals for templates', async () => {
      // Manually trigger loadTemplateTotal for testing
      await component['loadTemplateTotal']('template-1');

      const totals = component.templateTotals();
      expect(totals['template-1']).toEqual({
        totalIncome: 5000,
        totalExpenses: 1500,
        remainingLivingAllowance: 3500,
        loading: false,
      });
    });

    it('should handle loading state correctly', async () => {
      // Make loadTemplateDetails return a delayed promise
      mockTemplateSelectionService.loadTemplateDetails = vi.fn(
        () =>
          new Promise<TemplateLine[]>((resolve) =>
            setTimeout(() => resolve([]), 50),
          ),
      ) as unknown as TemplateSelectionService['loadTemplateDetails'];

      const loadPromise = component['loadTemplateTotal']('template-1');

      // Check loading state immediately
      expect(component.templateTotals()['template-1']).toEqual({
        totalIncome: 0,
        totalExpenses: 0,
        remainingLivingAllowance: 0,
        loading: true,
      });

      await loadPromise;

      // Check final state
      expect(component.templateTotals()['template-1'].loading).toBe(false);
    });

    it('should not reload already loaded totals', async () => {
      // Pre-populate totals
      component.templateTotals.set({
        'template-1': {
          totalIncome: 5000,
          totalExpenses: 1500,
          loading: false,
        },
      });

      vi.clearAllMocks();

      await component['loadTemplateTotal']('template-1');

      // Should not call loadTemplateDetails again
      expect(
        mockTemplateSelectionService.loadTemplateDetails,
      ).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      // Use a templateId that doesn't have any lines in the mock data
      const errorTemplateId = 'template-error';

      // Clear any pre-existing template totals and ensure clean state
      component.templateTotals.set({});

      // Mock the service to reject with an error
      mockTemplateSelectionService.loadTemplateDetails = vi
        .fn()
        .mockRejectedValue(
          new Error('API Error'),
        ) as unknown as TemplateSelectionService['loadTemplateDetails'];

      await component['loadTemplateTotal'](errorTemplateId);

      // The templateTotals should have the error state with 0 values
      const totals = component.templateTotals()[errorTemplateId];
      expect(totals).toBeDefined();
      expect(totals.totalIncome).toBe(0);
      expect(totals.totalExpenses).toBe(0);
      expect(totals.loading).toBe(false);
    });
  });

  describe('Template Selection', () => {
    it('should call selectTemplate when template is selected', () => {
      // Use a spy to intercept the method call
      const selectTemplateSpy = vi.spyOn(
        component.templateSelection,
        'selectTemplate',
      );

      component.onTemplateSelect('template-1');

      expect(selectTemplateSpy).toHaveBeenCalledWith('template-1');
    });

    it('should validate form correctly when template is selected', () => {
      // Set up valid form
      component.budgetForm.patchValue({
        monthYear: new Date(),
        description: 'Test budget',
        templateId: 'template-1',
      });

      // Mock selected template
      mockSelectedTemplateSignal.set(mockTemplates[0]);

      // Check form validity
      expect(component.budgetForm.valid).toBe(true);
      // Since we have control over the mock signal, we can check it directly
      expect(mockSelectedTemplateSignal()).toEqual(mockTemplates[0]);
    });
  });

  describe('Budget Creation', () => {
    beforeEach(() => {
      // Setup valid form for all budget creation tests
      const testDate = new Date();
      component.budgetForm.patchValue({
        monthYear: testDate,
        description: 'Test budget',
        templateId: 'template-1',
      });

      // Mark form as touched to make it valid
      Object.keys(component.budgetForm.controls).forEach((key) => {
        component.budgetForm.get(key)?.markAsTouched();
      });

      // Mock the selectedTemplate method to return a template
      vi.spyOn(component.templateSelection, 'selectedTemplate').mockReturnValue(
        mockTemplates[0],
      );
    });

    it('should close dialog with success data when budget creation succeeds', async () => {
      // Mock successful API response
      mockBudgetApi.createBudget$.mockReturnValue(of({ id: 'budget-123' }));

      await component.onCreateBudget();

      expect(mockDialogRef.close).toHaveBeenCalledWith({
        success: true,
        data: {
          monthYear: expect.any(Date),
          description: 'Test budget',
          templateId: 'template-1',
        },
      });

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Budget créé avec succès !',
        'Fermer',
        {
          duration: 5000,
          panelClass: ['bg-[color-primary]', 'text-[color-on-primary]'],
        },
      );
    });

    it('should show error snackbar and keep dialog open when budget creation fails', async () => {
      // Mock API error
      const mockError: BudgetApiError = {
        message: 'Template introuvable ou accès non autorisé',
      };
      mockBudgetApi.createBudget$.mockReturnValue(throwError(() => mockError));

      await component.onCreateBudget();

      // Dialog should not close
      expect(mockDialogRef.close).not.toHaveBeenCalled();

      // Error snackbar should be shown
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Erreur lors de la création du budget : Template introuvable ou accès non autorisé',
        'Fermer',
        {
          duration: 8000,
          panelClass: ['bg-[color-error]', 'text-[color-on-error]'],
        },
      );

      // Loading state should be reset
      expect(component.isCreating()).toBe(false);
    });

    it('should set loading state during budget creation', async () => {
      // Mock API call that takes time
      let resolvePromise: (value: unknown) => void;
      const delayedPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockBudgetApi.createBudget$.mockReturnValue(delayedPromise);

      // Start creation
      const createPromise = component.onCreateBudget();

      // Check loading state is set
      expect(component.isCreating()).toBe(true);

      // Resolve the API call
      resolvePromise!({ id: 'budget-123' });
      await createPromise;

      // Loading should be false after completion (handled by success flow)
      expect(component.isCreating()).toBe(false);
    });

    it('should not create budget if form is invalid', async () => {
      // Make form invalid
      component.budgetForm.patchValue({
        monthYear: null,
        description: '',
        templateId: '',
      });

      await component.onCreateBudget();

      expect(mockBudgetApi.createBudget$).not.toHaveBeenCalled();
      expect(mockDialogRef.close).not.toHaveBeenCalled();
      expect(mockSnackBar.open).not.toHaveBeenCalled();
    });

    it('should not create budget if no template is selected', async () => {
      // Mock no selected template
      vi.spyOn(component.templateSelection, 'selectedTemplate').mockReturnValue(
        null,
      );

      await component.onCreateBudget();

      expect(mockBudgetApi.createBudget$).not.toHaveBeenCalled();
      expect(mockDialogRef.close).not.toHaveBeenCalled();
      expect(mockSnackBar.open).not.toHaveBeenCalled();
    });

    it('should call API with correct budget data format', async () => {
      // Mock successful API response
      mockBudgetApi.createBudget$.mockReturnValue(of({ id: 'budget-123' }));

      const testDate = new Date(2024, 11, 1); // December 2024
      component.budgetForm.patchValue({
        monthYear: testDate,
        description: 'Test budget description',
        templateId: 'template-1',
      });

      await component.onCreateBudget();

      expect(mockBudgetApi.createBudget$).toHaveBeenCalledWith({
        month: 12, // getMonth() returns 11, + 1 = 12
        year: 2024,
        description: 'Test budget description',
        templateId: 'template-1',
      });
    });
  });

  describe('Reactivity with Record-based Signal', () => {
    it('should properly update Record-based signal', () => {
      // Initial state
      expect(component.templateTotals()).toEqual({});

      // Update with first template
      component.templateTotals.update((totals) => ({
        ...totals,
        'template-1': {
          totalIncome: 5000,
          totalExpenses: 1500,
          loading: false,
        },
      }));

      expect(component.templateTotals()['template-1']).toEqual({
        totalIncome: 5000,
        totalExpenses: 1500,
        loading: false,
      });

      // Update with second template
      component.templateTotals.update((totals) => ({
        ...totals,
        'template-2': {
          totalIncome: 8000,
          totalExpenses: 2500,
          loading: false,
        },
      }));

      // Both should exist
      expect(Object.keys(component.templateTotals())).toHaveLength(2);
      expect(component.templateTotals()['template-1']).toBeDefined();
      expect(component.templateTotals()['template-2']).toBeDefined();
    });
  });
});
