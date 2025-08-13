import {
  ChangeDetectionStrategy,
  Component,
  inject,
  effect,
  signal,
  computed,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import {
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MAT_DATE_FORMATS } from '@angular/material/core';
import { MAT_DATE_FNS_FORMATS } from '@angular/material-date-fns-adapter';
import { startOfMonth, setMonth, setYear } from 'date-fns';
import { firstValueFrom, startWith, debounceTime, map } from 'rxjs';
import { type BudgetTemplate } from '@pulpe/shared';
import { TemplateListItem } from './ui/template-list-item';
import { TemplateDetailsDialog } from './template-details-dialog';
import { TemplateStore } from './services/template-store';
import { TemplateTotalsCalculator } from './services/template-totals-calculator';
import {
  BudgetApi,
  type BudgetApiError,
} from '../../../../core/budget/budget-api';

const BUDGET_CREATION_CONSTANTS = {
  // Form validation constraints
  DESCRIPTION_MAX_LENGTH: 100,

  // Error messages
  ERROR_MESSAGES: {
    INVALID_DESCRIPTION: 'La description est requise',
    DESCRIPTION_TOO_LONG: 'La description ne peut pas dépasser 100 caractères',
  } as const,

  // Success messages
  SUCCESS_MESSAGES: {
    BUDGET_CREATED: 'Budget créé avec succès !',
  } as const,
} as const;

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
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatIconModule,
    MatRadioModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
    TemplateListItem,
  ],
  providers: [
    TemplateStore,
    TemplateTotalsCalculator,
    { provide: MAT_DATE_FORMATS, useValue: MONTH_YEAR_FORMATS },
  ],
  template: `
    <h2 mat-dialog-title>Nouveau budget</h2>

    <mat-dialog-content>
      <form
        [formGroup]="budgetForm"
        class="py-2 md:py-4 space-y-3 md:space-y-6"
      >
        <section class="space-y-2 md:space-y-4">
          <!-- General Information Section -->
          <h3 class="text-title-medium text-primary mb-2 md:mb-4">
            Informations générales
          </h3>

          <!-- Month/Year Picker -->
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Mois et année</mat-label>
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
            <mat-hint>mm.aaaa</mat-hint>
            @if (
              budgetForm.get('monthYear')?.invalid &&
              budgetForm.get('monthYear')?.touched
            ) {
              <mat-error>Le mois et l'année sont requis</mat-error>
            }
          </mat-form-field>

          <!-- Description Field -->
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Description</mat-label>
            <input
              matInput
              formControlName="description"
              [maxlength]="constants.DESCRIPTION_MAX_LENGTH"
              placeholder="Saisissez une description pour ce budget"
            />
            <mat-hint align="end"
              >{{ descriptionLength() }}/{{
                constants.DESCRIPTION_MAX_LENGTH
              }}</mat-hint
            >
            @if (
              budgetForm.get('description')?.invalid &&
              budgetForm.get('description')?.touched
            ) {
              <mat-error>
                @if (budgetForm.get('description')?.errors?.['required']) {
                  {{ constants.ERROR_MESSAGES.INVALID_DESCRIPTION }}
                }
                @if (budgetForm.get('description')?.errors?.['maxlength']) {
                  {{ constants.ERROR_MESSAGES.DESCRIPTION_TOO_LONG }}
                }
              </mat-error>
            }
          </mat-form-field>
        </section>
        <section>
          <!-- Model Selection Section -->
          <h3 class="text-title-medium text-primary mb-2 md:mb-4">
            Sélection du modèle
          </h3>

          <!-- Search Field -->
          <mat-form-field appearance="outline" class="w-full mb-2 md:mb-4">
            <mat-label>Rechercher un modèle</mat-label>
            <input
              matInput
              [formControl]="searchControl"
              placeholder="Nom ou description..."
            />
            <mat-icon matPrefix>search</mat-icon>
            @if (searchControl.value) {
              <button
                matIconButton
                matSuffix
                (click)="searchControl.setValue('')"
              >
                <mat-icon>clear</mat-icon>
              </button>
            }
          </mat-form-field>

          <!-- Templates List -->
          <div class="template-list">
            @if (templateStore.templates.isLoading()) {
              <div class="flex justify-center items-center h-[200px]">
                <mat-progress-spinner
                  mode="indeterminate"
                  aria-label="Chargement des modèles"
                  role="progressbar"
                  class="pulpe-loading-indicator pulpe-loading-medium"
                ></mat-progress-spinner>
              </div>
            } @else if (templateStore.templates.error()) {
              <div
                class="flex flex-col items-center justify-center h-[200px] text-error"
              >
                <mat-icon class="text-display-small mb-2"
                  >error_outline</mat-icon
                >
                <p class="text-label-large">
                  Erreur lors du chargement des modèles
                </p>
                <button
                  matButton
                  color="primary"
                  (click)="templateStore.reloadTemplates()"
                >
                  Réessayer
                </button>
              </div>
            } @else if (filteredTemplates().length === 0) {
              <div
                class="flex flex-col items-center justify-center h-[200px] text-on-surface-variant"
              >
                <mat-icon class="text-display-small mb-2">inbox</mat-icon>
                <p class="text-label-large">
                  @if (searchControl.value) {
                    Aucun modèle trouvé pour "{{ searchControl.value }}"
                  } @else {
                    Aucun modèle disponible
                  }
                </p>
              </div>
            } @else {
              <mat-radio-group
                [value]="templateStore.selectedTemplateId()"
                (change)="onTemplateSelect($event.value)"
                class="flex flex-col gap-2 md:gap-3"
                data-testid="template-selection-radio-group"
              >
                @for (template of filteredTemplates(); track template.id) {
                  @let templateTotals =
                    templateStore.templateTotalsMap()[template.id];
                  <pulpe-template-list-item
                    [template]="template"
                    [isSelected]="
                      templateStore.selectedTemplateId() === template.id
                    "
                    [totalIncome]="templateTotals?.totalIncome || 0"
                    [totalExpenses]="
                      (templateTotals?.totalExpenses || 0) +
                      (templateTotals?.totalSavings || 0)
                    "
                    [remainingLivingAllowance]="
                      templateTotals?.remainingLivingAllowance || 0
                    "
                    [loading]="templateTotals?.loading || !templateTotals"
                    (selectTemplate)="onTemplateSelect($event)"
                    (showDetails)="showTemplateDetails($event)"
                    [attr.data-testid]="'template-card-' + template.id"
                  />
                }
              </mat-radio-group>
            }
          </div>
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
        Annuler
      </button>
      <button
        mat-flat-button
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
            aria-label="Création en cours"
            role="progressbar"
            class="pulpe-loading-indicator pulpe-loading-small mr-2"
          ></mat-progress-spinner>
          <span aria-live="polite">Création...</span>
        } @else {
          Créer le budget
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    :host {
      display: block;
    }

    mat-dialog-content {
      max-height: 80vh;
      overflow-y: auto;
    }

    .template-list {
      min-height: 250px;
      max-height: 350px;
      overflow-y: auto;
      padding: 0.375rem;
      border: 1px solid var(--mat-form-field-outline-color);
      border-radius: 4px;
      background-color: var(--mat-app-surface);
    }

    @media (max-width: 640px) {
      mat-dialog-content {
        max-height: 75vh;
      }

      .template-list {
        min-height: 200px;
        max-height: 300px;
        padding: 0.25rem;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateBudgetDialogComponent {
  readonly #dialogRef = inject(MatDialogRef<CreateBudgetDialogComponent>);
  readonly #formBuilder = inject(FormBuilder);
  readonly #dialog = inject(MatDialog);
  readonly #snackBar = inject(MatSnackBar);
  readonly #budgetApi = inject(BudgetApi);
  readonly templateStore = inject(TemplateStore);

  // Expose constants for template usage
  readonly constants = BUDGET_CREATION_CONSTANTS;

  // UI State - Search control moved to component
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly searchTerm = toSignal(
    this.searchControl.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      map((term) => term.toLowerCase().trim()),
    ),
    { initialValue: '' },
  );

  // Computed filtered templates (UI logic in component)
  readonly filteredTemplates = computed(() => {
    const templates = this.templateStore.templates.value() || [];
    const search = this.searchTerm();

    let filtered = templates;
    if (search) {
      filtered = templates.filter(
        (template: BudgetTemplate) =>
          template.name.toLowerCase().includes(search) ||
          template.description?.toLowerCase().includes(search),
      );
    }

    // Sort to put default template first
    return [...filtered].sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return 0;
    });
  });

  budgetForm = this.#formBuilder.nonNullable.group({
    monthYear: [startOfMonth(new Date()), Validators.required],
    description: [
      '',
      [
        Validators.required,
        Validators.maxLength(BUDGET_CREATION_CONSTANTS.DESCRIPTION_MAX_LENGTH),
      ],
    ],
    templateId: ['', Validators.required],
  });

  readonly isCreating = signal(false);

  readonly #descriptionFormValue = toSignal(
    this.budgetForm.get('description')!.valueChanges,
    {
      initialValue: this.budgetForm.get('description')!.value || '',
    },
  );
  readonly descriptionLength = computed(() => {
    const value = this.#descriptionFormValue();
    return value?.length || 0;
  });

  constructor() {
    // Sync selected template with form
    effect(() => {
      const selectedId = this.templateStore.selectedTemplateId();
      if (selectedId) {
        this.budgetForm.patchValue({ templateId: selectedId });
      } else {
        this.budgetForm.patchValue({ templateId: '' });
      }
    });

    // Load template totals when filtered templates change
    effect(() => {
      const templates = this.filteredTemplates();
      if (!templates.length) return;

      // Initialize default selection on first load
      this.templateStore.initializeDefaultSelection();

      // Load template totals for visible templates
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

  async showTemplateDetails(template: BudgetTemplate): Promise<void> {
    // Récupérer les templateLines depuis le cache ou les charger si nécessaire
    let templateLines = this.templateStore.getCachedTemplateDetails(
      template.id,
    );

    if (!templateLines) {
      // Si pas dans le cache, les charger maintenant
      templateLines = await this.templateStore.loadTemplateDetails(template.id);
    }

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
        BUDGET_CREATION_CONSTANTS.SUCCESS_MESSAGES.BUDGET_CREATED,
        'Fermer',
        {
          duration: 5000,
          panelClass: ['bg-[color-primary]', 'text-[color-on-primary]'],
        },
      );
    } catch (error) {
      this.isCreating.set(false);

      // Show error snackbar with centrally processed error message
      this.#snackBar.open(
        `Erreur lors de la création du budget : ${(error as BudgetApiError).message}`,
        'Fermer',
        {
          duration: 8000,
          panelClass: ['bg-[color-error]', 'text-[color-on-error]'],
        },
      );
    }
  }
}
