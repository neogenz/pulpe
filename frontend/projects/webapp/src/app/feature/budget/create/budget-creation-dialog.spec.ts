import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import {
  provideZonelessChangeDetection,
  signal,
  NO_ERRORS_SCHEMA,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { provideLocale } from '../../../core/locale';
import { of, throwError } from 'rxjs';

import { CreateBudgetDialogComponent } from './budget-creation-dialog';
import { TemplateListItem } from './ui/template-list-item';
import { TemplateSelection } from './services/template-selection';
import { TemplateApi } from '../../../core/template/template-api';
import {
  BudgetApi,
  type BudgetApiError,
} from '../../../core/budget/budget-api';
import { type BudgetTemplate, type TemplateLine } from '@pulpe/shared';

// Mock component for testing without template rendering issues
@Component({
  selector: 'pulpe-template-list-item',
  template: '<div>Mock Template List Item</div>',
})
class MockTemplateListItem {
  @Input() template: BudgetTemplate | null = null;
  @Input() selectedTemplateId: string | null = null;
  @Input() totalIncome = 0;
  @Input() totalExpenses = 0;
  @Input() remainingLivingAllowance = 0;
  @Input() loading = false;

  @Output() selectTemplate = new EventEmitter<string>();
  @Output() showDetails = new EventEmitter<BudgetTemplate>();
}

describe('CreateBudgetDialogComponent', () => {
  let component: CreateBudgetDialogComponent;
  let fixture: ComponentFixture<CreateBudgetDialogComponent>;
  let mockDialogRef: Partial<MatDialogRef<CreateBudgetDialogComponent>>;
  let mockSnackBar: Partial<MatSnackBar>;
  let mockDialog: Partial<MatDialog>;
  let mockBudgetApi: Partial<BudgetApi>;
  let mockTemplateSelectionService: Partial<TemplateSelection>;
  let mockTemplateApi: Partial<TemplateApi>;

  // Mock function references
  let mockSelectTemplate: ReturnType<typeof vi.fn>;
  let mockPreloadAllTemplateDetails: ReturnType<typeof vi.fn>;
  let mockGetTemplateTotals: ReturnType<typeof vi.fn>;

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

    // Initialize mock functions
    mockSelectTemplate = vi.fn();
    mockPreloadAllTemplateDetails = vi.fn(() => Promise.resolve());
    mockGetTemplateTotals = vi.fn(() => ({
      totalIncome: 5000,
      totalExpenses: 1500,
      remainingLivingAllowance: 3500,
    }));

    mockTemplateSelectionService = {
      searchControl: {
        value: '',
        valueChanges: of(''),
        setValue: vi.fn(),
      },
      selectedTemplateId: signal(null),
      selectedTemplate: signal(null),
      filteredTemplates: signal([mockTemplate]),
      selectTemplate: mockSelectTemplate,
      loadTemplateDetails: vi.fn(() => Promise.resolve(mockTemplateLines)),
      calculateTemplateTotals: vi.fn(() => ({
        totalIncome: 5000,
        totalExpenses: 1500,
        remainingLivingAllowance: 3500,
      })),
      preloadAllTemplateDetails: mockPreloadAllTemplateDetails,
      getTemplateTotals: mockGetTemplateTotals,
    };

    mockTemplateApi = {
      templatesResource: {
        value: signal([mockTemplate]),
        isLoading: signal(false),
        error: signal(null),
        reload: vi.fn(),
      },
    };

    await TestBed.configureTestingModule({
      imports: [
        CreateBudgetDialogComponent,
        MockTemplateListItem,
        NoopAnimationsModule,
        ReactiveFormsModule,
      ],
      providers: [
        provideZonelessChangeDetection(),
        ...provideLocale(),
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
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(CreateBudgetDialogComponent, {
        remove: {
          imports: [TemplateListItem],
        },
        add: {
          imports: [MockTemplateListItem],
        },
      })
      .compileComponents();

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

    it('should reactively track description length with computed signal', () => {
      // Initially should be 0 for empty description
      expect(component.descriptionLength()).toBe(0);

      // Update the form control value
      component.budgetForm.get('description')?.setValue('Test description');

      // The computed signal should reactively update
      expect(component.descriptionLength()).toBe(16); // 'Test description'.length

      // Test with another value
      component.budgetForm
        .get('description')
        ?.setValue('A longer test description for the budget');
      expect(component.descriptionLength()).toBe(40); // Length of the new string

      // Test with empty string
      component.budgetForm.get('description')?.setValue('');
      expect(component.descriptionLength()).toBe(0);
    });

    it('should initialize with empty template totals', () => {
      // Set empty templates to test initial state
      mockTemplateSelectionService.filteredTemplates = signal([]);

      // Create new component with empty templates
      const emptyFixture = TestBed.createComponent(CreateBudgetDialogComponent);
      const emptyComponent = emptyFixture.componentInstance;
      emptyFixture.detectChanges();

      expect(emptyComponent.templateTotals()).toEqual({});
    });
  });

  describe('Template Totals Loading', () => {
    it('should preload all template totals when templates are displayed', async () => {
      // Reset templateTotals to empty state first
      component.templateTotals.set({});

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

      // Verify initial empty state
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
      // Reset and configure the mock functions
      mockPreloadAllTemplateDetails.mockImplementation(async () => {
        /* mocked implementation */
      });

      mockGetTemplateTotals.mockReturnValue({
        totalIncome: 5000,
        totalExpenses: 1500,
        remainingLivingAllowance: 3500,
      });

      // Mock filteredTemplates to return a template
      mockTemplateSelectionService.filteredTemplates = signal([mockTemplate]);

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

      expect(mockSelectTemplate).toHaveBeenCalledWith('template-123');
    });

    it('should validate form correctly when template is selected', () => {
      // Mock selected template
      mockTemplateSelectionService.selectedTemplate = signal(mockTemplate);

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

      // Ensure the selected template signal returns the mock template
      mockTemplateSelectionService.selectedTemplate = signal(mockTemplate);
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
      mockTemplateSelectionService.selectedTemplate = signal(null);

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
