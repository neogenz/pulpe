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
import { MatDatepickerInput } from '@angular/material/datepicker';
import { MatSnackBar } from '@angular/material/snack-bar';
import { By } from '@angular/platform-browser';
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
import { BUDGET_MAX_YEAR, BUDGET_MIN_YEAR } from 'pulpe-shared';
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
  const dialogRef = { close, disableClose: false };
  const generateBudgets = vi.fn();
  const loadTemplateLines = vi.fn();
  const dialogOpen = vi.fn();
  const snackBarOpen = vi.fn();
  const selectedTemplateId = signal<string | null>(TEMPLATE_ID);
  const generateBudgetsError = signal<unknown>(undefined);
  const isGeneratingBudgets = signal(false);

  beforeEach(async () => {
    close.mockClear();
    generateBudgets.mockReset().mockResolvedValue(response);
    loadTemplateLines.mockReset().mockResolvedValue([]);
    dialogOpen.mockReset();
    snackBarOpen.mockReset();
    dialogRef.disableClose = false;
    selectedTemplateId.set(TEMPLATE_ID);
    generateBudgetsError.set(undefined);
    isGeneratingBudgets.set(false);

    const templateStore = {
      templates: signal<BudgetTemplate[]>([]),
      sortedTemplates: signal<BudgetTemplate[]>([]),
      selectedTemplateId,
      templateTotalsMap: signal<Record<string, TemplateTotals>>({}),
      isLoading: signal(false),
      error: signal<unknown>(undefined),
      isGeneratingBudgets,
      generateBudgetsError,
      generateBudgets,
      selectTemplate: vi.fn(),
      reloadTemplates: vi.fn(),
      loadTemplateLines,
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
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MatDialog, useValue: { open: dialogOpen } },
        { provide: MatSnackBar, useValue: { open: snackBarOpen } },
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
    expect(component['planForm'].getRawValue()).toEqual({
      startPeriod: new Date(2026, 8, 1),
      endPeriod: new Date(2027, 7, 1),
    });
    expect(component['inclusivePeriodCount']()).toBe(12);
    expect(component['canSubmit']()).toBe(true);
  });

  it('uses the singular label for a one-month period', () => {
    component['planForm'].controls.endPeriod.setValue(new Date(2026, 8, 1));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('1 période');
  });

  it('constrains both month pickers to the shared budget year range', () => {
    const dateInputs = fixture.debugElement
      .queryAll(By.directive(MatDatepickerInput))
      .map((element) => element.injector.get(MatDatepickerInput));

    expect(dateInputs).toHaveLength(2);
    for (const input of dateInputs) {
      expect(input.min).toEqual(new Date(BUDGET_MIN_YEAR, 0, 1));
      expect(input.max).toEqual(new Date(BUDGET_MAX_YEAR, 11, 1));
    }
  });

  it.each([
    [new Date(2026, 7, 1), 'budget.planEndBeforeStart'],
    [new Date(2029, 8, 1), 'budget.planRangeTooLong'],
  ])('blocks an invalid end period', (endPeriod, errorKey) => {
    component['planForm'].controls.endPeriod.setValue(endPeriod);

    expect(component['rangeErrorKey']()).toBe(errorKey);
    expect(component['canSubmit']()).toBe(false);
  });

  it('announces a period rejected only by the shared contract', async () => {
    const maxYear = new Date().getFullYear() + 10;
    component['planForm'].setValue({
      startPeriod: new Date(maxYear, 11, 1),
      endPeriod: new Date(maxYear + 1, 0, 1),
    });
    fixture.detectChanges();

    expect(component['rangeErrorKey']()).toBe('budget.planInvalidPeriod');
    expect(component['canSubmit']()).toBe(false);
    expect(
      fixture.nativeElement.querySelector('[role="alert"]')?.textContent,
    ).toContain('La période sélectionnée est hors des dates autorisées');

    await component['submit']();

    expect(generateBudgets).not.toHaveBeenCalled();
  });

  it('submits the existing generation DTO and closes only on success', async () => {
    await component['submit']();

    expect(generateBudgets).toHaveBeenCalledWith({
      templateId: TEMPLATE_ID,
      startMonth: 9,
      startYear: 2026,
      count: 12,
    });
    expect(close).toHaveBeenCalledWith(response);
    expect(dialogRef.disableClose).toBe(true);
  });

  it('blocks every exit while pending and restores them after an error', async () => {
    let resolveGeneration!: (result: undefined) => void;
    generateBudgets.mockImplementationOnce(() => {
      isGeneratingBudgets.set(true);
      return new Promise<undefined>((resolve) => {
        resolveGeneration = resolve;
      });
    });

    const submission = component['submit']();
    fixture.detectChanges();

    const cancelButton = fixture.nativeElement.querySelector(
      'button[mat-dialog-close]',
    ) as HTMLButtonElement;
    const submitContent = fixture.nativeElement.querySelector(
      '[data-testid="plan-budgets-submit"] .flex.items-center.justify-center.gap-2',
    );
    expect(dialogRef.disableClose).toBe(true);
    expect(cancelButton.disabled).toBe(true);
    expect(submitContent?.querySelector('mat-progress-spinner')).not.toBeNull();

    generateBudgetsError.set(new Error('API failed'));
    isGeneratingBudgets.set(false);
    resolveGeneration(undefined);
    await submission;
    fixture.detectChanges();

    expect(dialogRef.disableClose).toBe(false);
    expect(cancelButton.disabled).toBe(false);
    expect(component['planForm'].getRawValue()).toEqual({
      startPeriod: new Date(2026, 8, 1),
      endPeriod: new Date(2027, 7, 1),
    });
  });

  it('keeps the dialog open and exposes a localized error', async () => {
    generateBudgets.mockResolvedValueOnce(undefined);
    generateBudgetsError.set(new Error('API failed'));

    await component['submit']();

    expect(close).not.toHaveBeenCalled();
    expect(component['submissionError']()).toBe(
      'La planification des budgets a échoué — réessaie',
    );
  });

  it('reports a template details loading failure without opening the dialog', async () => {
    loadTemplateLines.mockRejectedValueOnce(new Error('Network failure'));

    await component['showTemplateDetails']({
      template: { id: TEMPLATE_ID } as BudgetTemplate,
      income: 0,
      expenses: 0,
      netBalance: 0,
      loading: false,
    });

    expect(dialogOpen).not.toHaveBeenCalled();
    expect(snackBarOpen).toHaveBeenCalledWith(
      "Quelque chose n'a pas fonctionné — réessaie",
      'Fermer',
      { duration: 8000, panelClass: ['!bg-error', '!text-on-error'] },
    );
  });
});
