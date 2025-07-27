import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  Component,
  signal,
  provideZonelessChangeDetection,
} from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { CurrencyPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatRadioModule } from '@angular/material/radio';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TemplateListItem } from './template-list-item';
import { type BudgetTemplate } from '@pulpe/shared';

// Test host component to test input/output behavior
@Component({
  imports: [TemplateListItem],
  template: `
    <pulpe-template-list-item
      [template]="template()"
      [selectedTemplateId]="selectedTemplateId()"
      [totalIncome]="totalIncome()"
      [totalExpenses]="totalExpenses()"
      [remainingLivingAllowance]="remainingLivingAllowance()"
      [loading]="loading()"
      (selectTemplate)="onSelectTemplate($event)"
      (showDetails)="onShowDetails($event)"
    />
  `,
})
class TestHostComponent {
  template = signal<BudgetTemplate>({
    id: 'test-template-id',
    name: 'Test Template',
    description: 'A test template description',
    isDefault: false,
    user_id: 'test-user-id',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  });

  selectedTemplateId = signal<string | null>(null);
  totalIncome = signal(3000);
  totalExpenses = signal(2500);
  remainingLivingAllowance = signal(500);
  loading = signal(false);

  selectedTemplateId_output: string | null = null;
  showDetailsTemplate_output: BudgetTemplate | null = null;

  onSelectTemplate(templateId: string): void {
    this.selectedTemplateId_output = templateId;
  }

  onShowDetails(template: BudgetTemplate): void {
    this.showDetailsTemplate_output = template;
  }
}

describe('TemplateListItem', () => {
  let component: TemplateListItem;
  let fixture: ComponentFixture<TemplateListItem>;
  let hostComponent: TestHostComponent;
  let hostFixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        NoopAnimationsModule,
        CurrencyPipe,
        MatCardModule,
        MatRadioModule,
        MatIconModule,
        MatButtonModule,
        MatChipsModule,
        MatTooltipModule,
        MatProgressSpinnerModule,
        TemplateListItem,
        TestHostComponent,
      ],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    // Test standalone component
    fixture = TestBed.createComponent(TemplateListItem);
    component = fixture.componentInstance;

    // Test with host component for input/output testing
    hostFixture = TestBed.createComponent(TestHostComponent);
    hostComponent = hostFixture.componentInstance;
  });

  describe('Standalone Component', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should have correct input signals', () => {
      expect(component.template).toBeDefined();
      expect(component.selectedTemplateId).toBeDefined();
      expect(component.totalIncome).toBeDefined();
      expect(component.totalExpenses).toBeDefined();
      expect(component.remainingLivingAllowance).toBeDefined();
      expect(component.loading).toBeDefined();
    });

    it('should have correct output signals', () => {
      expect(component.selectTemplate).toBeDefined();
      expect(component.showDetails).toBeDefined();
    });

    it('should compute isSelected correctly', () => {
      const mockTemplate: BudgetTemplate = {
        id: 'template-123',
        name: 'Test Template',
        description: 'Description',
        isDefault: false,
        user_id: 'user-id',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      // Set inputs using fixture.componentRef.setInput
      fixture.componentRef.setInput('template', mockTemplate);
      fixture.componentRef.setInput('selectedTemplateId', 'template-123');
      fixture.detectChanges();

      expect(component.isSelected()).toBe(true);

      // Change selected template ID
      fixture.componentRef.setInput('selectedTemplateId', 'different-id');
      fixture.detectChanges();

      expect(component.isSelected()).toBe(false);
    });

    it('should compute isSelected as false when selectedTemplateId is null', () => {
      const mockTemplate: BudgetTemplate = {
        id: 'template-123',
        name: 'Test Template',
        description: 'Description',
        isDefault: false,
        user_id: 'user-id',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      fixture.componentRef.setInput('template', mockTemplate);
      fixture.componentRef.setInput('selectedTemplateId', null);
      fixture.detectChanges();

      expect(component.isSelected()).toBe(false);
    });
  });

  describe('Host Component Integration', () => {
    beforeEach(() => {
      hostFixture.detectChanges();
    });

    it('should display template information correctly', () => {
      const compiled = hostFixture.nativeElement as HTMLElement;

      expect(compiled.textContent).toContain('Test Template');
      expect(compiled.textContent).toContain('A test template description');
    });

    it('should display financial information correctly', () => {
      const compiled = hostFixture.nativeElement as HTMLElement;

      expect(compiled.textContent).toContain('Revenus: CHF 3,000');
      expect(compiled.textContent).toContain('Dépenses: CHF 2,500');
      expect(compiled.textContent).toContain('Reste à vivre: CHF 500');
    });

    it('should show default chip when template is default', () => {
      hostComponent.template.update((template) => ({
        ...template,
        isDefault: true,
      }));
      hostFixture.detectChanges();

      const compiled = hostFixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Par défaut');
    });

    it('should not show default chip when template is not default', () => {
      hostComponent.template.update((template) => ({
        ...template,
        isDefault: false,
      }));
      hostFixture.detectChanges();

      const compiled = hostFixture.nativeElement as HTMLElement;
      expect(compiled.textContent).not.toContain('Par défaut');
    });

    it('should show loading state correctly', () => {
      hostComponent.loading.set(true);
      hostFixture.detectChanges();

      const compiled = hostFixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Chargement...');
      expect(compiled.querySelector('mat-spinner')).toBeTruthy();
    });

    it('should hide financial details when loading', () => {
      hostComponent.loading.set(true);
      hostFixture.detectChanges();

      const compiled = hostFixture.nativeElement as HTMLElement;
      expect(compiled.textContent).not.toContain('Revenus:');
      expect(compiled.textContent).not.toContain('Dépenses:');
      expect(compiled.textContent).not.toContain('Reste à vivre:');
    });

    it('should apply selected styling when template is selected', () => {
      hostComponent.selectedTemplateId.set('test-template-id');
      hostFixture.detectChanges();

      const cardElement = hostFixture.nativeElement.querySelector('mat-card');
      expect(cardElement?.classList.contains('ring-2')).toBe(true);
      expect(cardElement?.classList.contains('ring-primary')).toBe(true);
    });

    it('should not apply selected styling when template is not selected', () => {
      hostComponent.selectedTemplateId.set('different-id');
      hostFixture.detectChanges();

      const cardElement = hostFixture.nativeElement.querySelector('mat-card');
      expect(cardElement?.classList.contains('ring-2')).toBe(false);
      expect(cardElement?.classList.contains('ring-primary')).toBe(false);
    });

    it('should handle null description gracefully', () => {
      hostComponent.template.update((template) => ({
        ...template,
        description: '',
      }));
      hostFixture.detectChanges();

      const compiled = hostFixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Test Template');
      // Description paragraph should not be present when empty
      expect(
        compiled.querySelector('.text-body-medium.text-on-surface-variant'),
      ).toBeFalsy();
    });

    it('should emit selectTemplate event when card is clicked', () => {
      const cardElement = hostFixture.nativeElement.querySelector('mat-card');

      cardElement?.click();

      expect(hostComponent.selectedTemplateId_output).toBe('test-template-id');
    });

    it('should emit selectTemplate event when radio button is clicked', () => {
      const radioButton =
        hostFixture.nativeElement.querySelector('mat-radio-button');

      radioButton?.click();

      expect(hostComponent.selectedTemplateId_output).toBe('test-template-id');
    });

    it('should emit showDetails event when details button is clicked', () => {
      const detailsButton = hostFixture.nativeElement.querySelector('button');

      detailsButton?.click();

      expect(hostComponent.showDetailsTemplate_output).toEqual(
        hostComponent.template(),
      );
    });

    it('should stop event propagation when details button is clicked', () => {
      // Reset the output to ensure we can test properly
      hostComponent.selectedTemplateId_output = null;

      const detailsButton = hostFixture.nativeElement.querySelector('button');

      detailsButton?.click();

      // Should emit showDetails but NOT selectTemplate due to stopPropagation
      expect(hostComponent.showDetailsTemplate_output).toEqual(
        hostComponent.template(),
      );
      expect(hostComponent.selectedTemplateId_output).toBeNull();
    });

    describe('Financial Display Logic', () => {
      it('should show positive remaining allowance in success color', () => {
        hostComponent.remainingLivingAllowance.set(1000);
        hostFixture.detectChanges();

        const remainingElement =
          hostFixture.nativeElement.querySelector('.text-success');
        expect(remainingElement?.textContent).toContain('CHF 1,000');
      });

      it('should show zero remaining allowance in warning color', () => {
        hostComponent.remainingLivingAllowance.set(0);
        hostFixture.detectChanges();

        const remainingElement =
          hostFixture.nativeElement.querySelector('.text-warning');
        expect(remainingElement?.textContent).toContain('CHF 0');
      });

      it('should show negative remaining allowance in error color', () => {
        hostComponent.remainingLivingAllowance.set(-500);
        hostFixture.detectChanges();

        const remainingElement =
          hostFixture.nativeElement.querySelector('.text-error');
        expect(remainingElement?.textContent).toContain('CHF -500');
      });

      it('should format currency correctly for large numbers', () => {
        hostComponent.totalIncome.set(12345);
        hostComponent.totalExpenses.set(9876);
        hostFixture.detectChanges();

        const compiled = hostFixture.nativeElement as HTMLElement;
        expect(compiled.textContent).toContain('CHF 12,345');
        expect(compiled.textContent).toContain('CHF 9,876');
      });
    });

    describe('Responsive Design', () => {
      it('should show "Détails" text on larger screens', () => {
        const detailsButton = hostFixture.nativeElement.querySelector(
          'button span.hidden.sm\\:inline',
        );
        expect(detailsButton?.textContent?.trim()).toBe('Détails');
      });

      it('should show info icon on smaller screens', () => {
        const infoIcon = hostFixture.nativeElement.querySelector(
          'button mat-icon.sm\\:hidden',
        );
        expect(infoIcon?.textContent?.trim()).toBe('info');
      });
    });
  });
});
