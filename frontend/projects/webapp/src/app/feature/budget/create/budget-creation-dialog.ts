import {
  ChangeDetectionStrategy,
  Component,
  inject,
  effect,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormGroup,
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
import { firstValueFrom } from 'rxjs';
import { type BudgetTemplate } from '@pulpe/shared';
import { TemplateListItem } from './ui/template-list-item';
import { TemplateDetailsDialog } from './template-details-dialog';
import { TemplateSelection } from './services/template-selection';
import { TemplateApi } from '../../../core/template/template-api';
import {
  BudgetApi,
  type BudgetApiError,
} from '../../../core/budget/budget-api';
import { BUDGET_CREATION_CONSTANTS } from './budget-creation.constants';

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
    TemplateSelection,
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
              [formControl]="templateSelection.searchControl"
              placeholder="Nom ou description..."
            />
            <mat-icon matPrefix>search</mat-icon>
            @if (templateSelection.searchControl.value) {
              <button
                mat-icon-button
                matSuffix
                (click)="templateSelection.searchControl.setValue('')"
                type="button"
              >
                <mat-icon>clear</mat-icon>
              </button>
            }
          </mat-form-field>

          <!-- Templates List -->
          <div class="template-list">
            @if (templateApi.templatesResource.isLoading()) {
              <div class="flex justify-center items-center h-[200px]">
                <mat-spinner diameter="40"></mat-spinner>
              </div>
            } @else if (templateApi.templatesResource.error()) {
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
                  (click)="templateApi.templatesResource.reload()"
                >
                  Réessayer
                </button>
              </div>
            } @else if (templateSelection.filteredTemplates().length === 0) {
              <div
                class="flex flex-col items-center justify-center h-[200px] text-on-surface-variant"
              >
                <mat-icon class="text-display-small mb-2">inbox</mat-icon>
                <p class="text-label-large">
                  @if (templateSelection.searchControl.value) {
                    Aucun modèle trouvé pour "{{
                      templateSelection.searchControl.value
                    }}"
                  } @else {
                    Aucun modèle disponible
                  }
                </p>
              </div>
            } @else {
              <mat-radio-group
                [value]="templateSelection.selectedTemplateId()"
                (change)="onTemplateSelect($event.value)"
                class="flex flex-col gap-2 md:gap-3"
              >
                @for (
                  template of templateSelection.filteredTemplates();
                  track template.id
                ) {
                  @let totals = templateTotals()[template.id];
                  <pulpe-template-list-item
                    [template]="template"
                    [selectedTemplateId]="
                      templateSelection.selectedTemplateId()
                    "
                    [totalIncome]="totals?.totalIncome || 0"
                    [totalExpenses]="totals?.totalExpenses || 0"
                    [remainingLivingAllowance]="
                      totals?.remainingLivingAllowance || 0
                    "
                    [loading]="totals?.loading || !totals"
                    (selectTemplate)="onTemplateSelect($event)"
                    (showDetails)="showTemplateDetails($event)"
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
          !templateSelection.selectedTemplate() ||
          isCreating()
        "
        (click)="onCreateBudget()"
        class="w-full md:w-auto min-h-[44px]"
      >
        @if (isCreating()) {
          <mat-spinner diameter="20" class="mr-2"></mat-spinner>
          Création...
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
  readonly templateSelection = inject(TemplateSelection);
  readonly templateApi = inject(TemplateApi);

  // Expose constants for template usage
  readonly constants = BUDGET_CREATION_CONSTANTS;

  budgetForm: FormGroup;

  // Creation state
  readonly isCreating = signal(false);

  // Template totals state
  readonly templateTotals = signal<
    Record<
      string,
      {
        totalIncome: number;
        totalExpenses: number;
        remainingLivingAllowance: number;
        loading: boolean;
      }
    >
  >({});

  // Signal for description length - initialized in constructor
  readonly descriptionLength = signal(0);

  constructor() {
    // Initialize form with current year default using date-fns
    const currentDate = startOfMonth(new Date());

    this.budgetForm = this.#formBuilder.group({
      monthYear: [currentDate, Validators.required],
      description: [
        '',
        [
          Validators.required,
          Validators.maxLength(
            BUDGET_CREATION_CONSTANTS.DESCRIPTION_MAX_LENGTH,
          ),
        ],
      ],
      templateId: ['', Validators.required],
    });

    // Set up reactive description length tracking
    const descriptionControl = this.budgetForm.get('description')!;
    const descriptionValue = toSignal(descriptionControl.valueChanges, {
      initialValue: descriptionControl.value || '',
    });

    effect(() => {
      const value = descriptionValue();
      this.descriptionLength.set(value?.length || 0);
    });

    // Sync selected template with form
    effect(() => {
      const selectedId = this.templateSelection.selectedTemplateId();
      if (selectedId) {
        this.budgetForm.patchValue({ templateId: selectedId });
      } else {
        this.budgetForm.patchValue({ templateId: '' });
      }
    });

    // Load template totals when templates are loaded - batch load for better performance
    effect(() => {
      const templates = this.templateSelection.filteredTemplates();
      if (templates.length > 0) {
        this.preloadAllTemplateTotals();
      }
    });
  }

  private async preloadAllTemplateTotals(): Promise<void> {
    const templates = this.templateSelection.filteredTemplates();
    const currentTotals = this.templateTotals();

    // Only load templates that aren't already loaded or loading
    const templatesToLoad = templates.filter(
      (template) => !currentTotals[template.id],
    );

    if (templatesToLoad.length === 0) {
      return;
    }

    // Set loading state for all templates that need to be loaded
    const loadingStates = templatesToLoad.reduce(
      (acc, template) => {
        acc[template.id] = {
          totalIncome: 0,
          totalExpenses: 0,
          remainingLivingAllowance: 0,
          loading: true,
        };
        return acc;
      },
      {} as Record<
        string,
        {
          totalIncome: number;
          totalExpenses: number;
          remainingLivingAllowance: number;
          loading: boolean;
        }
      >,
    );

    this.templateTotals.update((current) => ({
      ...current,
      ...loadingStates,
    }));

    try {
      // Use the service's optimized preload method
      await this.templateSelection.preloadAllTemplateDetails();

      // Calculate totals for all loaded templates
      const calculatedTotals = templatesToLoad.reduce(
        (acc, template) => {
          const cachedTotals = this.templateSelection.getTemplateTotals(
            template.id,
          );
          if (cachedTotals) {
            acc[template.id] = { ...cachedTotals, loading: false };
          } else {
            // Fallback to zero values if calculation failed
            acc[template.id] = {
              totalIncome: 0,
              totalExpenses: 0,
              remainingLivingAllowance: 0,
              loading: false,
            };
          }
          return acc;
        },
        {} as Record<
          string,
          {
            totalIncome: number;
            totalExpenses: number;
            remainingLivingAllowance: number;
            loading: boolean;
          }
        >,
      );

      // Update all totals at once
      this.templateTotals.update((current) => ({
        ...current,
        ...calculatedTotals,
      }));
    } catch (error) {
      console.error('Error preloading template totals:', error);

      // Set error state for all templates
      const errorStates = templatesToLoad.reduce(
        (acc, template) => {
          acc[template.id] = {
            totalIncome: 0,
            totalExpenses: 0,
            remainingLivingAllowance: 0,
            loading: false,
          };
          return acc;
        },
        {} as Record<
          string,
          {
            totalIncome: number;
            totalExpenses: number;
            remainingLivingAllowance: number;
            loading: boolean;
          }
        >,
      );

      this.templateTotals.update((current) => ({
        ...current,
        ...errorStates,
      }));
    }
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
    this.templateSelection.selectTemplate(templateId);
  }

  showTemplateDetails(template: BudgetTemplate): void {
    this.#dialog.open(TemplateDetailsDialog, {
      data: { template },
      width: '600px',
      maxWidth: '95vw',
      maxHeight: '85vh',
      autoFocus: 'first-tabbable',
    });
  }

  async onCreateBudget(): Promise<void> {
    if (!this.budgetForm.valid || !this.templateSelection.selectedTemplate()) {
      return;
    }

    const formData = this.budgetForm.value;

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
