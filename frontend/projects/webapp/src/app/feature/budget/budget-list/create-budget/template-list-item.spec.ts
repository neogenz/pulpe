import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatCardModule } from '@angular/material/card';
import { MatRadioModule } from '@angular/material/radio';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { setTestInput } from '@app/testing/signal-test-utils';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { TemplateListItem } from './template-list-item';
import { type TemplateViewModel } from './template-view-model';

const templateViewModel: TemplateViewModel = {
  template: {
    id: '00000000-0000-4000-8000-000000000111',
    name: 'Mois standard',
    description: 'Budget mensuel',
    isDefault: true,
    userId: 'user-123',
    createdAt: '2026-07-28T00:00:00Z',
    updatedAt: '2026-07-28T00:00:00Z',
  },
  income: 5_000,
  expenses: 3_000,
  netBalance: 2_000,
  loading: false,
};

describe('TemplateListItem', () => {
  let component: TemplateListItem;
  let fixture: ComponentFixture<TemplateListItem>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        NoopAnimationsModule,
        MatCardModule,
        MatRadioModule,
        MatIconModule,
        MatButtonModule,
        MatChipsModule,
        MatTooltipModule,
        MatProgressSpinnerModule,
        TemplateListItem,
      ],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TemplateListItem);
    component = fixture.componentInstance;
  });

  describe('Standalone Component - Basic Structure', () => {
    it('should have input and output properties defined', () => {
      // These are the properties that should exist on the component class with new Angular input/output APIs
      expect(component.templateViewModel).toBeDefined();
      expect(typeof component.templateViewModel).toBe('function'); // signal
      expect(component.isSelected).toBeDefined();
      expect(typeof component.isSelected).toBe('function'); // signal
      expect(component.selectTemplate).toBeDefined();
      expect(typeof component.selectTemplate.emit).toBe('function'); // output
      expect(component.showDetails).toBeDefined();
      expect(typeof component.showDetails.emit).toBe('function'); // output
    });

    it('should have required input properties', () => {
      // Test that the component has the expected input properties defined with Angular 20 APIs
      // templateViewModel is required, isSelected has default value
      expect(component.templateViewModel).toBeDefined();
      expect(typeof component.templateViewModel).toBe('function'); // signal
      expect(component.isSelected).toBeDefined();
      expect(typeof component.isSelected).toBe('function'); // signal
    });
  });

  it('renders the translated details action without selecting the template', () => {
    const showDetails = vi.fn();
    const selectTemplate = vi.fn();
    component.showDetails.subscribe(showDetails);
    component.selectTemplate.subscribe(selectTemplate);
    setTestInput(component.templateViewModel, templateViewModel);

    fixture.detectChanges();

    const detailsButton = fixture.nativeElement.querySelector(
      'button',
    ) as HTMLButtonElement | null;
    expect(detailsButton?.textContent).toContain('Détails');
    expect(detailsButton?.textContent).not.toContain('template.details');

    detailsButton?.click();

    expect(showDetails).toHaveBeenCalledWith(templateViewModel);
    expect(selectTemplate).not.toHaveBeenCalled();
  });
});
