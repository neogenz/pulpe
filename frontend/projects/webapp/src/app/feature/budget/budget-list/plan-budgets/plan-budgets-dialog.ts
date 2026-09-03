import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MAT_DATE_FORMATS } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiErrorLocalizer } from '@core/api/api-error-localizer';
import { isApiError } from '@core/api/api-error';
import { getMonthYearDateFormats } from '@core/date/date-display-formats';
import { UserSettingsStore } from '@core/user-settings';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { type BudgetGenerateResponse, type BudgetPeriod } from 'pulpe-shared';
import { TemplateDetailsDialog } from '../create-budget/template-details-dialog';
import { type TemplateViewModel } from '../create-budget/template-view-model';
import { TemplatesList } from '../create-budget/templates-list';
import { TemplateStore } from '../create-budget/services/template-store';
import {
  defaultPlanBudgetPeriods,
  END_BEFORE_START,
  planBudgetCount,
  planBudgetsFormSchema,
  RANGE_TOO_LONG,
} from './plan-budgets-dialog.schema';

export interface PlanBudgetsDialogData {
  currentPeriod: BudgetPeriod;
}

const PERIOD_VALIDATION_TEMPLATE_ID = '00000000-0000-4000-8000-000000000001';

@Component({
  selector: 'pulpe-plan-budgets-dialog',
  imports: [
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
    TemplatesList,
    TranslocoPipe,
  ],
  providers: [
    TemplateStore,
    {
      provide: MAT_DATE_FORMATS,
      useFactory: () =>
        getMonthYearDateFormats(inject(UserSettingsStore).currency()),
    },
  ],
  template: `
    <h2 mat-dialog-title>{{ 'budget.planTitle' | transloco }}</h2>

    <mat-dialog-content>
      <form [formGroup]="planForm" class="py-2 md:py-4 space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'budget.planFrom' | transloco }}</mat-label>
            <input
              matInput
              readonly
              formControlName="startPeriod"
              [matDatepicker]="startPicker"
            />
            <mat-datepicker-toggle matSuffix [for]="startPicker" />
            <mat-datepicker
              #startPicker
              startView="multi-year"
              (monthSelected)="
                onMonthSelected('startPeriod', $event, startPicker)
              "
            />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>{{ 'budget.planTo' | transloco }}</mat-label>
            <input
              matInput
              readonly
              formControlName="endPeriod"
              [matDatepicker]="endPicker"
              [attr.aria-describedby]="rangeErrorKey() ? 'range-error' : null"
            />
            <mat-datepicker-toggle matSuffix [for]="endPicker" />
            <mat-datepicker
              #endPicker
              startView="multi-year"
              (monthSelected)="onMonthSelected('endPeriod', $event, endPicker)"
            />
          </mat-form-field>
        </div>

        @if (rangeErrorKey(); as errorKey) {
          <p id="range-error" class="text-body-medium text-error" role="alert">
            {{ errorKey | transloco }}
          </p>
        } @else {
          <p
            class="text-body-medium text-on-surface-variant"
            aria-live="polite"
          >
            {{
              'budget.planPeriodCount'
                | transloco: { count: inclusivePeriodCount() }
            }}
          </p>
        }

        <section>
          <h3 class="text-title-medium text-primary mb-2">
            {{ 'budget.modelSelection' | transloco }}
          </h3>
          <pulpe-templates-list
            [templates]="templateViewModels()"
            [selectedTemplateId]="templateStore.selectedTemplateId()"
            [isLoading]="templateStore.isLoading()"
            [hasError]="!!templateStore.error()"
            [currency]="currency()"
            (templateSelected)="templateStore.selectTemplate($event)"
            (templateDetailsRequested)="showTemplateDetails($event)"
            (retryRequested)="templateStore.reloadTemplates()"
          />
        </section>

        <p class="text-body-medium text-on-surface-variant">
          {{ 'budget.planExistingHint' | transloco }}
        </p>

        @if (submissionError(); as message) {
          <p class="text-body-medium text-error" role="alert">{{ message }}</p>
        }
      </form>
    </mat-dialog-content>

    <mat-dialog-actions
      align="end"
      class="px-3 pb-3 md:px-6 md:pb-4 flex flex-col-reverse md:flex-row gap-2"
    >
      <button
        matButton
        mat-dialog-close
        type="button"
        [disabled]="templateStore.isGeneratingBudgets()"
        class="w-full md:w-auto min-h-[44px]"
      >
        {{ 'common.cancel' | transloco }}
      </button>
      <button
        matButton="filled"
        type="button"
        class="w-full md:w-auto min-h-[44px]"
        data-testid="plan-budgets-submit"
        [disabled]="!canSubmit()"
        (click)="submit()"
      >
        @if (templateStore.isGeneratingBudgets()) {
          <mat-progress-spinner
            mode="indeterminate"
            [diameter]="24"
            role="progressbar"
            [attr.aria-label]="'budget.planInProgress' | transloco"
            class="pulpe-loading-indicator pulpe-loading-small mr-2 shrink-0"
          />
        }
        {{ 'budget.planAction' | transloco }}
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanBudgetsDialog {
  readonly #data = inject<PlanBudgetsDialogData>(MAT_DIALOG_DATA);
  readonly #dialogRef =
    inject<MatDialogRef<PlanBudgetsDialog, BudgetGenerateResponse>>(
      MatDialogRef,
    );
  readonly #dialog = inject(MatDialog);
  readonly #apiErrorLocalizer = inject(ApiErrorLocalizer);
  readonly #transloco = inject(TranslocoService);
  readonly #userSettings = inject(UserSettingsStore);
  protected readonly templateStore = inject(TemplateStore);
  protected readonly currency = this.#userSettings.currency;
  readonly submissionError = signal<string | null>(null);

  readonly planForm = inject(FormBuilder).nonNullable.group(
    defaultPlanBudgetPeriods(this.#data.currentPeriod),
  );
  readonly #formValue = toSignal(this.planForm.valueChanges, {
    initialValue: this.planForm.getRawValue(),
  });

  readonly inclusivePeriodCount = computed(() => {
    const { startPeriod, endPeriod } = this.#formValue();
    return startPeriod && endPeriod
      ? Math.max(0, planBudgetCount(startPeriod, endPeriod))
      : 0;
  });

  readonly rangeErrorKey = computed(() => {
    const result = planBudgetsFormSchema.safeParse({
      ...this.#formValue(),
      templateId: PERIOD_VALIDATION_TEMPLATE_ID,
    });
    if (result.success) return null;

    const reason = result.error.issues[0]?.message;
    if (reason === END_BEFORE_START) return 'budget.planEndBeforeStart';
    if (reason === RANGE_TOO_LONG) return 'budget.planRangeTooLong';
    return 'budget.planInvalidPeriod';
  });

  readonly canSubmit = computed(() => {
    const templateId = this.templateStore.selectedTemplateId();
    return (
      !!templateId &&
      !this.templateStore.isGeneratingBudgets() &&
      planBudgetsFormSchema.safeParse({
        ...this.#formValue(),
        templateId,
      }).success
    );
  });

  readonly templateViewModels = computed((): TemplateViewModel[] => {
    const totals = this.templateStore.templateTotalsMap();
    return this.templateStore.sortedTemplates().map((template) => ({
      template,
      income: totals[template.id]?.income ?? 0,
      expenses:
        (totals[template.id]?.expenses ?? 0) +
        (totals[template.id]?.savings ?? 0),
      netBalance: totals[template.id]?.netBalance ?? 0,
      loading: !totals[template.id],
    }));
  });

  onMonthSelected(
    controlName: 'startPeriod' | 'endPeriod',
    date: Date,
    picker: { close: () => void },
  ): void {
    this.planForm.controls[controlName].setValue(
      new Date(date.getFullYear(), date.getMonth(), 1),
    );
    this.planForm.controls[controlName].markAsTouched();
    picker.close();
  }

  async showTemplateDetails(viewModel: TemplateViewModel): Promise<void> {
    this.#dialog.open(TemplateDetailsDialog, {
      data: {
        template: viewModel.template,
        templateLines: await this.templateStore.loadTemplateLines(
          viewModel.template.id,
        ),
      },
      width: '600px',
      maxWidth: '95vw',
      maxHeight: '85vh',
      autoFocus: 'first-tabbable',
    });
  }

  async submit(): Promise<void> {
    const parsed = planBudgetsFormSchema.safeParse({
      ...this.planForm.getRawValue(),
      templateId: this.templateStore.selectedTemplateId(),
    });
    if (!parsed.success) return;

    this.submissionError.set(null);
    this.#dialogRef.disableClose = true;
    const result = await this.templateStore.generateBudgets(parsed.data);
    if (result) {
      this.#dialogRef.close(result);
      return;
    }

    this.#dialogRef.disableClose = false;
    const error = this.templateStore.generateBudgetsError();
    this.submissionError.set(
      isApiError(error)
        ? this.#apiErrorLocalizer.localizeApiError(error)
        : this.#transloco.translate('budget.planError'),
    );
  }
}
