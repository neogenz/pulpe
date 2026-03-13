import {
  ChangeDetectionStrategy,
  Component,
  inject,
  effect,
  signal,
  computed,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import {
  MatDialog,
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MAT_DATE_FORMATS } from '@angular/material/core';
import { MAT_DATE_FNS_FORMATS } from '@angular/material-date-fns-adapter';
import { startOfMonth, setMonth, setYear } from 'date-fns';
import { firstValueFrom } from 'rxjs';
import { TemplatesList } from './ui/templates-list';
import { type TemplateViewModel } from './ui/template-view-model';
import { TemplateDetailsDialog } from './template-details-dialog';
import { TemplateStore } from './services/template-store';
import { TemplateTotalsCalculator } from './services/template-totals-calculator';
import { BudgetApi } from '@core/budget/budget-api';
import { ApiErrorLocalizer } from '@core/api/api-error-localizer';
import { isApiError } from '@core/api/api-error';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

const DESCRIPTION_MAX_LENGTH = 100;

// Format personnalisé pour le month/year picker
const MONTH_YEAR_FORMATS = {
  ...MAT_DATE_FNS_FORMATS,
  parse: {
    ...MAT_DATE_FNS_FORMATS.parse,
    dateInput: ['MM.yyyy'],
  },
  display: {
    ...MAT_DATE_FNS_FORMATS.display,
    dateInput: 'MM.yyyy',
    monthYearLabel: 'MMM yyyy',
    dateA11yLabel: 'MM.yyyy',
    monthYearA11yLabel: 'MMMM yyyy',
  },
};

@Component({
  selector: 'pulpe-create-budget-dialog',
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
    TemplatesList,
    TranslocoPipe,
  ],
  providers: [
    TemplateStore,
    TemplateTotalsCalculator,
    { provide: MAT_DATE_FORMATS, useValue: MONTH_YEAR_FORMATS },
  ],
  template: `
    <h2 mat-dialog-title>{{ 'budget.createTitle' | transloco }}</h2>

    <mat-dialog-content>
      <form
        [formGroup]="budgetForm"
        class="py-2 md:py-4 space-y-3 md:space-y-6"
      >
        <section class="space-y-2 md:space-y-4">
          <!-- General Information Section -->
          <h3 class="text-title-medium text-primary mb-2 md:mb-4">
            {{ 'budget.generalInfo' | transloco }}
          </h3>

          <!-- Month/Year Picker -->
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>{{ 'budget.monthYearLabel' | transloco }}</mat-label>
            <input
              matInput
              [matDatepicker]="monthYearPicker"
              formControlName="monthYear"
              readonly
            />
            <mat-datepicker-toggle
              matSuffix
              [for]="monthYearPicker"
            ></mat-datepicker-toggle>
            <mat-datepicker
              #monthYearPicker
              startView="multi-year"
              (monthSelected)="onMonthSelected($event, monthYearPicker)"
            >
            </mat-datepicker>
            <mat-hint>{{ 'budget.monthYearHint' | transloco }}</mat-hint>
            @if (
              budgetForm.get('monthYear')?.invalid &&
              budgetForm.get('monthYear')?.touched
            ) {
              <mat-error>{{
                'budget.monthYearRequired' | transloco
              }}</mat-error>
            }
          </mat-form-field>

          <!-- Description Field -->
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>{{ 'budget.descriptionLabel' | transloco }}</mat-label>
            <input
              matInput
              formControlName="description"
              [maxlength]="maxDescriptionLength"
              [placeholder]="'budget.descriptionPlaceholder' | transloco"
            />
            <mat-hint align="end"
              >{{ descriptionLength() }}/{{ maxDescriptionLength }}</mat-hint
            >
            @if (budgetForm.get('description')?.errors?.['maxlength']) {
              <mat-error>
                {{ 'budget.descriptionTooLong' | transloco }}
              </mat-error>
            }
          </mat-form-field>
        </section>
        <section>
          <!-- Model Selection Section -->
          <h3 class="text-title-medium text-primary mb-2 md:mb-4">
            {{ 'budget.modelSelection' | transloco }}
          </h3>

          <!-- Templates List Component -->
          <pulpe-templates-list
            [templates]="templateViewModels()"
            [selectedTemplateId]="templateStore.selectedTemplateId()"
            [isLoading]="templateStore.isLoading()"
            [hasError]="!!templateStore.error()"
            (templateSelected)="onTemplateSelect($event)"
            (templateDetailsRequested)="showTemplateDetails($event)"
            (retryRequested)="templateStore.reloadTemplates()"
          />
        </section>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions
      align="end"
      class="px-3 pb-3 md:px-6 md:pb-4 flex flex-col-reverse md:flex-row gap-2 md:gap-0"
    >
      <button
        matButton
        mat-dialog-close
        class="w-full md:w-auto md:mr-2 min-h-[44px]"
      >
        {{ 'common.cancel' | transloco }}
      </button>
      <button
        matButton="filled"
        color="primary"
        [disabled]="
          budgetForm.invalid ||
          !templateStore.selectedTemplate() ||
          isCreating()
        "
        (click)="onCreateBudget()"
        class="w-full md:w-auto min-h-[44px]"
        data-testid="create-budget-button"
      >
        @if (isCreating()) {
          <mat-progress-spinner
            mode="indeterminate"
            [diameter]="24"
            [attr.aria-label]="'budget.creationInProgress' | transloco"
            role="progressbar"
            class="pulpe-loading-indicator pulpe-loading-small mr-2 flex-shrink-0"
          ></mat-progress-spinner>
          <span aria-live="polite">{{ 'budget.creating' | transloco }}</span>
        } @else {
          {{ 'budget.createButton' | transloco }}
        }
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateBudgetDialogComponent {
  readonly #dialogRef = inject(MatDialogRef<CreateBudgetDialogComponent>);
  readonly #formBuilder = inject(FormBuilder);
  readonly #dialog = inject(MatDialog);
  readonly #snackBar = inject(MatSnackBar);
  readonly #apiErrorLocalizer = inject(ApiErrorLocalizer);
  readonly #budgetApi = inject(BudgetApi);
  readonly #transloco = inject(TranslocoService);
  readonly templateStore = inject(TemplateStore);
  readonly #data = inject(MAT_DIALOG_DATA, { optional: true }) as {
    month?: number;
    year?: number;
  } | null;

  protected readonly maxDescriptionLength = DESCRIPTION_MAX_LENGTH;

  // Computed template view models for UI
  readonly templateViewModels = computed((): TemplateViewModel[] => {
    const templates = this.templateStore.templates();
    const totalsMap = this.templateStore.templateTotalsMap();

    // Transform templates to view models
    const viewModels = templates.map((template): TemplateViewModel => {
      const totals = totalsMap[template.id];
      return {
        template,
        income: totals?.income || 0,
        expenses: (totals?.expenses || 0) + (totals?.savings || 0), // Combine for display as per SPECS
        netBalance: totals?.netBalance || 0,
        loading: totals?.loading || !totals,
      };
    });

    // Sort to put default template first
    return [...viewModels].sort((a, b) => {
      if (a.template.isDefault && !b.template.isDefault) return -1;
      if (!a.template.isDefault && b.template.isDefault) return 1;
      return 0;
    });
  });

  budgetForm = this.#formBuilder.nonNullable.group({
    monthYear: [this.#getInitialDate(), Validators.required],
    description: ['', [Validators.maxLength(DESCRIPTION_MAX_LENGTH)]],
    templateId: ['', Validators.required],
  });

  readonly isCreating = signal(false);

  readonly #descriptionFormValue = toSignal(
    this.budgetForm.controls.description.valueChanges,
    {
      initialValue: this.budgetForm.controls.description.value ?? '',
    },
  );
  readonly descriptionLength = computed(
    () => this.#descriptionFormValue()?.length ?? 0,
  );

  #getInitialDate(): Date {
    // Si month et year sont fournis dans data, les utiliser
    if (this.#data?.month && this.#data?.year) {
      return startOfMonth(new Date(this.#data.year, this.#data.month - 1, 1));
    }

    // Sinon utilise la date actuelle
    return startOfMonth(new Date());
  }

  constructor() {
    // Initialize templates loading
    this.templateStore.loadTemplates();

    // Sync selected template with form
    effect(() => {
      const selectedId = this.templateStore.selectedTemplateId();
      if (selectedId) {
        this.budgetForm.patchValue({ templateId: selectedId });
      } else {
        this.budgetForm.patchValue({ templateId: '' });
      }
    });

    // Load template totals when templates change
    effect(() => {
      const templates = this.templateStore.templates();
      if (!templates.length) return;

      // Initialize default selection on first load
      this.templateStore.initializeDefaultSelection();

      // Load template totals for all templates
      const templateIds = templates.map((t) => t.id);
      this.templateStore.loadTemplateTotals(templateIds);
    });
  }

  onMonthSelected(
    normalizedMonthAndYear: Date,
    datePicker: { close: () => void },
  ): void {
    const currentValue = this.budgetForm.get('monthYear')?.value || new Date();
    const newDate = startOfMonth(
      setYear(
        setMonth(currentValue, normalizedMonthAndYear.getMonth()),
        normalizedMonthAndYear.getFullYear(),
      ),
    );

    this.budgetForm.get('monthYear')?.setValue(newDate);
    this.budgetForm.get('monthYear')?.markAsTouched();
    datePicker.close();
  }

  onTemplateSelect(templateId: string): void {
    this.templateStore.selectTemplate(templateId);
  }

  async showTemplateDetails(
    templateViewModel: TemplateViewModel,
  ): Promise<void> {
    const template = templateViewModel.template;
    const templateLines = await this.templateStore.loadTemplateLines(
      template.id,
    );

    this.#dialog.open(TemplateDetailsDialog, {
      data: {
        template,
        templateLines,
      },
      width: '600px',
      maxWidth: '95vw',
      maxHeight: '85vh',
      autoFocus: 'first-tabbable',
    });
  }

  async onCreateBudget(): Promise<void> {
    if (!this.budgetForm.valid || !this.templateStore.selectedTemplate()) {
      return;
    }

    const formData = this.budgetForm.getRawValue();

    this.isCreating.set(true);

    const budgetData = {
      month: formData.monthYear.getMonth() + 1, // getMonth() returns 0-11, we need 1-12
      year: formData.monthYear.getFullYear(),
      description: formData.description,
      templateId: formData.templateId,
    };

    try {
      await firstValueFrom(this.#budgetApi.createBudget$(budgetData));

      // Success - close dialog with success indicator
      this.isCreating.set(false);
      this.#dialogRef.close({ success: true, data: formData });

      this.#snackBar.open(
        this.#transloco.translate('budget.created'),
        this.#transloco.translate('common.close'),
        {
          duration: 5000,
          panelClass: ['bg-[color-primary]', 'text-[color-on-primary]'],
        },
      );
    } catch (error: unknown) {
      this.isCreating.set(false);

      const errorMessage = isApiError(error)
        ? this.#apiErrorLocalizer.localizeApiError(error)
        : this.#transloco.translate('budget.createError');

      // Show error snackbar with the localized message
      this.#snackBar.open(
        errorMessage,
        this.#transloco.translate('common.close'),
        {
          duration: 8000,
          panelClass: ['bg-[color-error]', 'text-[color-on-error]'],
        },
      );
    }
  }
}
