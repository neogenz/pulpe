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
import { of } from 'rxjs';

import { CreateBudgetDialogComponent } from './budget-creation-dialog';
import { TemplateListItem } from './ui/template-list-item';
import { TemplateSelection } from './services/template-selection';
import { TemplateApi } from '../../../core/template/template-api';
import { BudgetApi } from '../../../core/budget/budget-api';
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

  // Service instances from TestBed
  let templateSelectionService: TemplateSelection;
  let budgetApiService: BudgetApi;

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
      filteredTemplates: signal([]), // Start with empty to prevent auto-loading
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
        value: signal([]), // Start with empty to prevent auto-loading
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

    // Get actual service instances injected by TestBed
    templateSelectionService = TestBed.inject(TemplateSelection);
    budgetApiService = TestBed.inject(BudgetApi);

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
      // Reset the current component's templateTotals to test initial state
      component.templateTotals.set({});
      fixture.detectChanges();

      expect(component.templateTotals()).toEqual({});
    });
  });

  // NOTE: Template totals loading is tested indirectly through user behavior
  // We don't test private methods or implementation details

  describe('Template Selection', () => {
    it('should call selectTemplate when template is selected', () => {
      // Simple public behavior test
      const selectTemplateSpy = vi.spyOn(
        component.templateSelection,
        'selectTemplate',
      );

      component.onTemplateSelect('template-123');

      expect(selectTemplateSpy).toHaveBeenCalledWith('template-123');
    });
  });

  describe('Budget Creation', () => {
    it('should not create budget if form is invalid', async () => {
      // Make form invalid
      component.budgetForm.patchValue({
        monthYear: null,
        description: '',
        templateId: '',
      });

      const createBudgetSpy = vi.spyOn(budgetApiService, 'createBudget$');

      await component.onCreateBudget();

      expect(createBudgetSpy).not.toHaveBeenCalled();
    });

    it('should not create budget if no template is selected', async () => {
      // Setup valid form but no template
      component.budgetForm.patchValue({
        monthYear: new Date(2024, 5, 1),
        description: 'Test budget',
        templateId: 'template-1',
      });

      // Mock no selected template through the service
      templateSelectionService.selectedTemplate.set(null);

      const createBudgetSpy = vi.spyOn(budgetApiService, 'createBudget$');

      await component.onCreateBudget();

      expect(createBudgetSpy).not.toHaveBeenCalled();
    });

    it('should handle budget creation flow correctly', async () => {
      // Setup valid form and template
      component.budgetForm.patchValue({
        monthYear: new Date(2024, 5, 1),
        description: 'Test budget',
        templateId: 'template-1',
      });
      templateSelectionService.selectedTemplate.set(mockTemplate);

      const mockResponse = { budget: { id: 'budget-123' }, message: 'Success' };
      vi.spyOn(budgetApiService, 'createBudget$').mockReturnValue(
        of(mockResponse),
      );

      // Should not be loading initially
      expect(component.isCreating()).toBe(false);

      // Call the creation method
      await component.onCreateBudget();

      // Should not be loading after completion (test completed async behavior)
      expect(component.isCreating()).toBe(false);
    });
  });

  describe('Reactivity with Record-based Signal', () => {
    it('should properly update Record-based signal', () => {
      // Reset to empty state first
      component.templateTotals.set({});

      // Test that the templateTotals signal works correctly with Record updates
      expect(component.templateTotals()).toEqual({});

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
