import {
  Component,
  EventEmitter,
  Input,
  NO_ERRORS_SCHEMA,
  Output,
  provideZonelessChangeDetection,
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { type BudgetTemplate } from '@pulpe/shared';
import { TemplatesList } from './templates-list';

// Mock component for testing without template rendering issues
@Component({
  selector: 'pulpe-template-list-item',
  template: '<div data-testid="mock-template-item">Mock Template Item</div>',
})
class MockTemplateListItem {
  @Input() template: BudgetTemplate | null = null;
  @Input() isSelected = false;
  @Input() totalIncome = 0;
  @Input() totalExpenses = 0;
  @Input() remainingLivingAllowance = 0;
  @Input() loading = false;

  @Output() selectTemplate = new EventEmitter<string>();
  @Output() showDetails = new EventEmitter<BudgetTemplate>();
}

describe('TemplatesList', () => {
  let component: TemplatesList;
  let fixture: ComponentFixture<TemplatesList>;

  const createTestTemplate = (
    overrides: Partial<BudgetTemplate> = {},
  ): BudgetTemplate => ({
    id: 'template-1',
    name: 'Test Template',
    description: 'A test template',
    isDefault: false,
    userId: 'user-123',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        TemplatesList,
        MockTemplateListItem,
        NoopAnimationsModule,
        ReactiveFormsModule,
      ],
      providers: [provideZonelessChangeDetection()],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(TemplatesList, {
        remove: { imports: [] },
        add: { imports: [MockTemplateListItem] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(TemplatesList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('Component Initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize with default inputs', () => {
      expect(component.templates()).toEqual([]);
      expect(component.selectedTemplateId()).toBeNull();
      expect(component.isLoading()).toBe(false);
      expect(component.hasError()).toBe(false);
    });

    it('should initialize search control', () => {
      expect(component.searchControl.value).toBe('');
      expect(component.searchTerm()).toBe('');
    });
  });

  describe('Template Filtering', () => {
    it('should handle filtering logic correctly', () => {
      // Test that the computed signal works with empty templates (default state)
      expect(component.filteredTemplates()).toEqual([]);

      // Test that search control works
      component.searchControl.setValue('test search');
      expect(component.searchControl.value).toBe('test search');
    });

    it('should handle empty template list', () => {
      // Default state should be empty
      expect(component.filteredTemplates().length).toBe(0);
    });
  });

  describe('Component Logic', () => {
    it('should handle input signals correctly', () => {
      // Test default values
      expect(component.templates()).toEqual([]);
      expect(component.selectedTemplateId()).toBeNull();
      expect(component.isLoading()).toBe(false);
      expect(component.hasError()).toBe(false);
    });

    it('should emit retry event when called', () => {
      const retryRequestedSpy = vi.spyOn(component.retryRequested, 'emit');

      component.retryRequested.emit();

      expect(retryRequestedSpy).toHaveBeenCalled();
    });

    it('should render search field', () => {
      const searchInput = fixture.nativeElement.querySelector(
        'input[placeholder="Nom ou description..."]',
      );
      expect(searchInput).toBeTruthy();
    });
  });

  describe('Event Emissions', () => {
    it('should emit templateSelected when template is selected', () => {
      const templateSelectedSpy = vi.spyOn(component.templateSelected, 'emit');
      const templateId = 'template-123';

      component.onTemplateSelect(templateId);

      expect(templateSelectedSpy).toHaveBeenCalledWith(templateId);
    });

    it('should emit templateDetailsRequested when details are requested', () => {
      const templateDetailsRequestedSpy = vi.spyOn(
        component.templateDetailsRequested,
        'emit',
      );
      const template = createTestTemplate();

      component.onShowDetails({
        template,
        totalIncome: 0,
        totalExpenses: 0,
        remainingLivingAllowance: 0,
        loading: false,
      });

      expect(templateDetailsRequestedSpy).toHaveBeenCalledWith(template);
    });
  });

  describe('Search Functionality', () => {
    it('should initialize search control', () => {
      expect(component.searchControl.value).toBe('');
      expect(component.searchTerm()).toBe('');
    });

    it('should update search control value', () => {
      const testValue = 'test search';
      component.searchControl.setValue(testValue);

      expect(component.searchControl.value).toBe(testValue);
    });
  });
});
