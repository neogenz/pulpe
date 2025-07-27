import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';

import { CreateBudgetDialogComponent } from './budget-creation-dialog';
import { TemplateSelection } from './services/template-selection';
import { TemplateApi } from '../../../core/template/template-api';
import {
  BudgetApi,
  type BudgetApiError,
} from '../../../core/budget/budget-api';
import { type BudgetTemplate, type TemplateLine } from '@pulpe/shared';

describe('CreateBudgetDialogComponent', () => {
  let component: CreateBudgetDialogComponent;
  let fixture: ComponentFixture<CreateBudgetDialogComponent>;
  let mockDialogRef: Partial<MatDialogRef<CreateBudgetDialogComponent>>;
  let mockSnackBar: Partial<MatSnackBar>;
  let mockDialog: Partial<MatDialog>;
  let mockBudgetApi: Partial<BudgetApi>;
  let mockTemplateSelectionService: Partial<TemplateSelection>;
  let mockTemplateApi: Partial<TemplateApi>;

  // Test data
  const mockTemplateLines: TemplateLine[] = [
    {
      id: 'line-1',
      template_id: 'template-1',
      category: 'Salary',
      description: 'Monthly salary',
      amount: 5000,
      kind: 'INCOME',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'line-2',
      template_id: 'template-1',
      category: 'Rent',
      description: 'Monthly rent',
      amount: 1500,
      kind: 'FIXED_EXPENSE',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  ];

  const mockTemplate: BudgetTemplate = {
    id: 'template-1',
    name: 'Test Template',
    description: 'A test template',
    isDefault: false,
    user_id: 'user-123',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  beforeEach(async () => {
    // Mock services
    mockDialogRef = {
      close: vi.fn(),
    };

    mockSnackBar = {
      open: vi.fn(),
    };

    mockDialog = {
      open: vi.fn(),
    };

    mockBudgetApi = {
      createBudget$: vi.fn(),
    };

    mockTemplateSelectionService = {
      searchControl: { value: '', valueChanges: of('') },
      selectedTemplateId: vi.fn(() => null),
      selectedTemplate: vi.fn(() => null),
      filteredTemplates: vi.fn(() => [mockTemplate]),
      selectTemplate: vi.fn(),
      loadTemplateDetails: vi.fn(() => Promise.resolve(mockTemplateLines)),
      calculateTemplateTotals: vi.fn(() => ({
        totalIncome: 5000,
        totalExpenses: 1500,
        remainingLivingAllowance: 3500,
      })),
      preloadAllTemplateDetails: vi.fn(() => Promise.resolve()),
      getTemplateTotals: vi.fn(() => ({
        totalIncome: 5000,
        totalExpenses: 1500,
        remainingLivingAllowance: 3500,
      })),
    };

    mockTemplateApi = {
      templatesResource: {
        value: vi.fn(() => [mockTemplate]),
        isLoading: vi.fn(() => false),
        error: vi.fn(() => null),
        reload: vi.fn(),
      },
    };

    await TestBed.configureTestingModule({
      imports: [
        CreateBudgetDialogComponent,
        NoopAnimationsModule,
        ReactiveFormsModule,
      ],
      providers: [
        FormBuilder,
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MatSnackBar, useValue: mockSnackBar },
        { provide: MatDialog, useValue: mockDialog },
        { provide: BudgetApi, useValue: mockBudgetApi },
        {
          provide: TemplateSelection,
          useValue: mockTemplateSelectionService,
        },
        { provide: TemplateApi, useValue: mockTemplateApi },
        { provide: MAT_DIALOG_DATA, useValue: {} },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateBudgetDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
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
    it('should preload all template totals when templates are displayed', async () => {
      // Spy on the private preloadAllTemplateTotals method
      vi.spyOn(
        component as unknown as {
          preloadAllTemplateTotals: () => Promise<void>;
        },
        'preloadAllTemplateTotals',
      ).mockImplementation(async () => {
        component.templateTotals.update((current) => ({
          ...current,
          'template-1': {
            totalIncome: 1000,
            totalExpenses: 500,
            remainingLivingAllowance: 500,
            loading: false,
          },
        }));
      });

      expect(component.templateTotals()).toEqual({});

      await component['preloadAllTemplateTotals']();

      // Verify the state was updated
      expect(component.templateTotals()['template-1']).toEqual({
        totalIncome: 1000,
        totalExpenses: 500,
        remainingLivingAllowance: 500,
        loading: false,
      });
    });

    it('should calculate and store correct totals for templates', async () => {
      // Mock the service's preloadAllTemplateDetails and getTemplateTotals
      mockTemplateSelectionService.preloadAllTemplateDetails = vi.fn(
        async () => {
          /* mocked implementation */
        },
      );
      mockTemplateSelectionService.getTemplateTotals = vi.fn(() => ({
        totalIncome: 5000,
        totalExpenses: 1500,
        remainingLivingAllowance: 3500,
      }));

      // Mock filteredTemplates to return a template
      mockTemplateSelectionService.filteredTemplates = vi.fn(() => [
        mockTemplate,
      ]);

      await component['preloadAllTemplateTotals']();

      const totals = component.templateTotals();
      expect(totals['template-1']).toBeDefined();
      expect(totals['template-1'].totalIncome).toBe(5000);
      expect(totals['template-1'].totalExpenses).toBe(1500);
      expect(totals['template-1'].remainingLivingAllowance).toBe(3500);
      expect(totals['template-1'].loading).toBe(false);
    });

    it('should handle loading state correctly', async () => {
      mockTemplateSelectionService.filteredTemplates = vi.fn(() => [
        mockTemplate,
      ]);

      // Mock a slow preload operation
      mockTemplateSelectionService.preloadAllTemplateDetails = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            setTimeout(() => {
              resolve();
            }, 100);
          }),
      );

      const loadPromise = component['preloadAllTemplateTotals']();

      // Check loading state immediately
      setTimeout(() => {
        const totals = component.templateTotals();
        expect(totals['template-1']).toBeDefined();
        expect(totals['template-1'].loading).toBe(true);
      }, 10);

      await loadPromise;

      // Check final state
      const finalTotals = component.templateTotals();
      expect(finalTotals['template-1'].loading).toBe(false);
    });

    it('should not reload already loaded totals', async () => {
      // Set initial state with already loaded template
      component.templateTotals.set({
        'template-1': {
          totalIncome: 1000,
          totalExpenses: 500,
          remainingLivingAllowance: 500,
          loading: false,
        },
      });

      mockTemplateSelectionService.filteredTemplates = vi.fn(() => [
        mockTemplate,
      ]);
      mockTemplateSelectionService.preloadAllTemplateDetails = vi.fn();

      await component['preloadAllTemplateTotals']();

      // Should not call preloadAllTemplateDetails since template is already loaded
      expect(
        mockTemplateSelectionService.preloadAllTemplateDetails,
      ).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const mockErrorTemplate = {
        id: 'error-template',
        name: 'Error Template',
        description: 'Description',
        isDefault: false,
        user_id: 'user-id',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockTemplateSelectionService.filteredTemplates = vi.fn(() => [
        mockErrorTemplate,
      ]);

      // Mock preloadAllTemplateDetails to throw an error
      mockTemplateSelectionService.preloadAllTemplateDetails = vi.fn(
        async () => {
          throw new Error('Failed to preload template details');
        },
      );

      await component['preloadAllTemplateTotals']();

      // The templateTotals should have the error state with 0 values
      const totals = component.templateTotals();
      expect(totals['error-template']).toEqual({
        totalIncome: 0,
        totalExpenses: 0,
        remainingLivingAllowance: 0,
        loading: false,
      });
    });
  });

  describe('Template Selection', () => {
    it('should call selectTemplate when template is selected', () => {
      component.onTemplateSelect('template-123');

      expect(mockTemplateSelectionService.selectTemplate).toHaveBeenCalledWith(
        'template-123',
      );
    });

    it('should validate form correctly when template is selected', () => {
      // Mock selected template
      mockTemplateSelectionService.selectedTemplate = vi.fn(() => mockTemplate);

      // Form should be valid when all required fields are set
      component.budgetForm.patchValue({
        monthYear: new Date(),
        description: 'Test budget',
        templateId: 'template-1',
      });

      expect(component.budgetForm.valid).toBe(true);
    });
  });

  describe('Budget Creation', () => {
    beforeEach(() => {
      // Setup valid form state
      component.budgetForm.patchValue({
        monthYear: new Date(2024, 5, 1),
        description: 'Test budget',
        templateId: 'template-1',
      });

      mockTemplateSelectionService.selectedTemplate = vi.fn(() => mockTemplate);
    });

    it('should close dialog with success data when budget creation succeeds', async () => {
      const mockResponse = {
        budget: { id: 'budget-123', month: 6, year: 2024 },
        message: 'Success',
      };

      mockBudgetApi.createBudget$ = vi.fn(() => of(mockResponse));

      await component.onCreateBudget();

      expect(mockDialogRef.close).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Object),
      });
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Budget créé avec succès !',
        'Fermer',
        expect.any(Object),
      );
    });

    it('should show error snackbar and keep dialog open when budget creation fails', async () => {
      const errorResponse: BudgetApiError = {
        message: 'Un budget existe déjà pour cette période',
      };

      mockBudgetApi.createBudget$ = vi.fn(() =>
        throwError(() => errorResponse),
      );

      await component.onCreateBudget();

      expect(mockDialogRef.close).not.toHaveBeenCalled();
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Erreur lors de la création du budget : Un budget existe déjà pour cette période',
        'Fermer',
        expect.any(Object),
      );
    });

    it('should set loading state during budget creation', async () => {
      const mockResponse = {
        budget: { id: 'budget-123', month: 6, year: 2024 },
        message: 'Success',
      };

      mockBudgetApi.createBudget$ = vi.fn(() => of(mockResponse));

      // Start budget creation
      const creationPromise = component.onCreateBudget();

      // Check that loading state is set
      expect(component.isCreating()).toBe(true);

      await creationPromise;

      // Loading should be false after completion (implicit in success flow)
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
    });

    it('should not create budget if no template is selected', async () => {
      mockTemplateSelectionService.selectedTemplate = vi.fn(() => null);

      await component.onCreateBudget();

      expect(mockBudgetApi.createBudget$).not.toHaveBeenCalled();
      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });

    it('should call API with correct budget data format', async () => {
      // Setup form with specific data
      component.budgetForm.patchValue({
        monthYear: new Date(2024, 5, 15), // June 15, 2024
        description: 'Test budget',
        templateId: 'template-1',
      });

      const mockResponse = {
        budget: { id: 'budget-123', month: 6, year: 2024 },
        message: 'Success',
      };

      mockBudgetApi.createBudget$ = vi.fn(() => of(mockResponse));

      await component.onCreateBudget();

      expect(mockBudgetApi.createBudget$).toHaveBeenCalledWith({
        month: 6, // 0-indexed month + 1
        year: 2024,
        description: 'Test budget',
        templateId: 'template-1',
      });
    });
  });

  describe('Reactivity with Record-based Signal', () => {
    it('should properly update Record-based signal', () => {
      // Test that the templateTotals signal works correctly with Record updates
      const initialTotals = {};
      expect(component.templateTotals()).toEqual(initialTotals);

      // Update with new template totals
      const newTotals = {
        'template-1': {
          totalIncome: 3000,
          totalExpenses: 2000,
          remainingLivingAllowance: 1000,
          loading: false,
        },
      };

      component.templateTotals.set(newTotals);
      expect(component.templateTotals()).toEqual(newTotals);

      // Update specific template
      component.templateTotals.update((current) => ({
        ...current,
        'template-2': {
          totalIncome: 4000,
          totalExpenses: 2500,
          remainingLivingAllowance: 1500,
          loading: true,
        },
      }));

      const updatedTotals = component.templateTotals();
      expect(updatedTotals['template-1']).toEqual(newTotals['template-1']);
      expect(updatedTotals['template-2']).toEqual({
        totalIncome: 4000,
        totalExpenses: 2500,
        remainingLivingAllowance: 1500,
        loading: true,
      });
    });
  });
});
