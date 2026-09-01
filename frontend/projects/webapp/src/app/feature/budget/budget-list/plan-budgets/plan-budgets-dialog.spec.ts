import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  provideZonelessChangeDetection,
  signal,
} from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogRef,
} from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ApiErrorLocalizer } from '@core/api/api-error-localizer';
import { provideLocale } from '@core/locale';
import { UserSettingsStore } from '@core/user-settings';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import type {
  BudgetGenerateResponse,
  BudgetTemplate,
  SupportedCurrency,
  SupportedLocale,
} from 'pulpe-shared';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  TemplateStore,
  type TemplateTotals,
} from '../create-budget/services/template-store';
import { type TemplateViewModel } from '../create-budget/template-view-model';
import { TemplatesList } from '../create-budget/templates-list';
import { PlanBudgetsDialog } from './plan-budgets-dialog';

const TEMPLATE_ID = '00000000-0000-4000-8000-000000000001';
const response: BudgetGenerateResponse = {
  success: true,
  data: { budgets: [], skippedMonths: [{ month: 10, year: 2026 }] },
};

@Component({
  selector: 'pulpe-templates-list',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockTemplatesList {
  @Input() templates: TemplateViewModel[] = [];
  @Input() selectedTemplateId: string | null = null;
  @Input() isLoading = false;
  @Input() hasError = false;
  @Input() currency: SupportedCurrency = 'CHF';
  @Output() templateSelected = new EventEmitter<string>();
  @Output() templateDetailsRequested = new EventEmitter<TemplateViewModel>();
  @Output() retryRequested = new EventEmitter<void>();
}

describe('PlanBudgetsDialog', () => {
  let component: PlanBudgetsDialog;
  let fixture: ComponentFixture<PlanBudgetsDialog>;
  const close = vi.fn();
  const generateBudgets = vi.fn();
  const selectedTemplateId = signal<string | null>(TEMPLATE_ID);
  const generateBudgetsError = signal<unknown>(undefined);

  beforeEach(async () => {
    close.mockClear();
    generateBudgets.mockReset().mockResolvedValue(response);
    selectedTemplateId.set(TEMPLATE_ID);
    generateBudgetsError.set(undefined);

    const templateStore = {
      templates: signal<BudgetTemplate[]>([]),
      sortedTemplates: signal<BudgetTemplate[]>([]),
      selectedTemplateId,
      templateTotalsMap: signal<Record<string, TemplateTotals>>({}),
      isLoading: signal(false),
      error: signal<unknown>(undefined),
      isGeneratingBudgets: signal(false),
      generateBudgetsError,
      generateBudgets,
      selectTemplate: vi.fn(),
      reloadTemplates: vi.fn(),
      loadTemplateLines: vi.fn().mockResolvedValue([]),
    };

    await TestBed.configureTestingModule({
      imports: [PlanBudgetsDialog, MockTemplatesList, NoopAnimationsModule],
      providers: [
        provideZonelessChangeDetection(),
        ...provideLocale(),
        ...provideTranslocoForTest(),
        {
          provide: UserSettingsStore,
          useValue: {
            currency: signal<SupportedCurrency>('CHF'),
            locale: signal<SupportedLocale>('fr'),
          },
        },
        {
          provide: MAT_DIALOG_DATA,
          useValue: { currentPeriod: { month: 9, year: 2026 } },
        },
        { provide: MatDialogRef, useValue: { close } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        {
          provide: ApiErrorLocalizer,
          useValue: { localizeApiError: () => 'Erreur localisée' },
        },
      ],
    })
      .overrideComponent(PlanBudgetsDialog, {
        remove: { imports: [TemplatesList], providers: [TemplateStore] },
        add: {
          imports: [MockTemplatesList],
          providers: [{ provide: TemplateStore, useValue: templateStore }],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PlanBudgetsDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('starts on the current cycle with twelve inclusive periods', () => {
    expect(component.planForm.getRawValue()).toEqual({
      startPeriod: new Date(2026, 8, 1),
      endPeriod: new Date(2027, 7, 1),
    });
    expect(component.inclusivePeriodCount()).toBe(12);
    expect(component.canSubmit()).toBe(true);
  });

  it.each([
    [new Date(2026, 7, 1), 'budget.planEndBeforeStart'],
    [new Date(2029, 8, 1), 'budget.planRangeTooLong'],
  ])('blocks an invalid end period', (endPeriod, errorKey) => {
    component.planForm.controls.endPeriod.setValue(endPeriod);

    expect(component.rangeErrorKey()).toBe(errorKey);
    expect(component.canSubmit()).toBe(false);
  });

  it('submits the existing generation DTO and closes only on success', async () => {
    await component.submit();

    expect(generateBudgets).toHaveBeenCalledWith({
      templateId: TEMPLATE_ID,
      startMonth: 9,
      startYear: 2026,
      count: 12,
    });
    expect(close).toHaveBeenCalledWith(response);
  });

  it('keeps the dialog open and exposes a localized error', async () => {
    generateBudgets.mockResolvedValueOnce(undefined);
    generateBudgetsError.set(new Error('API failed'));

    await component.submit();

    expect(close).not.toHaveBeenCalled();
    expect(component.submissionError()).toBe(
      'La planification des budgets a échoué — réessaie',
    );
  });
});
