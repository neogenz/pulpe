import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  effect,
  signal,
} from '@angular/core';
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
import { MAT_DATE_FORMATS } from '@angular/material/core';
import { MAT_DATE_FNS_FORMATS } from '@angular/material-date-fns-adapter';
import { startOfMonth } from 'date-fns';
import { type BudgetTemplate } from '@pulpe/shared';
import { BudgetCreationFormState } from './budget-creation-form-state';
import { TemplateListItem, TemplateDetailsDialog } from './components';
import { TemplateSelectionService } from './services';
import { TemplateApi } from '../../../core/template/template-api';

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
  selector: 'pulpe-month-dialog',
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
    BudgetCreationFormState,
    TemplateSelectionService,
    { provide: MAT_DATE_FORMATS, useValue: MONTH_YEAR_FORMATS },
  ],
  template: `
    <h2 mat-dialog-title>Nouveau budget</h2>

    <mat-dialog-content>
      <form [formGroup]="budgetForm" class="py-4 space-y-4 md:space-y-6">
        <section class="space-y-2 md:space-y-4">
          <!-- General Information Section -->
          <h3 class="text-title-medium text-primary mb-4">
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
              maxlength="100"
              placeholder="Saisissez une description pour ce budget"
            />
            <mat-hint align="end">{{ descriptionLength() }}/100</mat-hint>
            @if (
              budgetForm.get('description')?.invalid &&
              budgetForm.get('description')?.touched
            ) {
              <mat-error>
                @if (budgetForm.get('description')?.errors?.['required']) {
                  La description est requise
                }
                @if (budgetForm.get('description')?.errors?.['maxlength']) {
                  La description ne peut pas dépasser 100 caractères
                }
              </mat-error>
            }
          </mat-form-field>
        </section>
        <section>
          <!-- Model Selection Section -->
          <h3 class="text-title-medium text-primary mb-4">
            Sélection du modèle
          </h3>

          <!-- Search Field -->
          <mat-form-field appearance="outline" class="w-full mb-4">
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
                  mat-button
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
                class="flex flex-col gap-3"
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
      class="px-4 pb-4 md:px-6 md:pb-4 flex flex-col md:flex-row gap-2 md:gap-0"
    >
      <button mat-button mat-dialog-close class="order-2 md:order-1 md:mr-2">
        Annuler
      </button>
      <button
        mat-flat-button
        color="primary"
        [disabled]="budgetForm.invalid || !templateSelection.selectedTemplate()"
        (click)="onCreateBudget()"
        class="order-1 md:order-2 w-full md:w-auto"
      >
        Créer le budget
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
      min-height: 300px;
      max-height: 400px;
      overflow-y: auto;
      padding: 0.5rem;
      border: 1px solid var(--mat-form-field-outline-color);
      border-radius: 4px;
      background-color: var(--mat-app-surface);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateBudgetDialogComponent {
  readonly #dialogRef = inject(MatDialogRef<CreateBudgetDialogComponent>);
  readonly #formBuilder = inject(FormBuilder);
  readonly #formState = inject(BudgetCreationFormState);
  readonly #dialog = inject(MatDialog);
  readonly templateSelection = inject(TemplateSelectionService);
  readonly templateApi = inject(TemplateApi);

  budgetForm: FormGroup;

  // Template totals state
  readonly templateTotals = signal<
    Record<
      string,
      { totalIncome: number; totalExpenses: number; loading: boolean }
    >
  >({});

  // Computed signal for description length
  descriptionLength = computed(() => {
    return this.budgetForm.get('description')?.value?.length || 0;
  });

  constructor() {
    // Initialize form with current year default using date-fns
    const currentDate = startOfMonth(new Date());

    this.budgetForm = this.#formBuilder.group({
      monthYear: [currentDate, Validators.required],
      description: ['', [Validators.required, Validators.maxLength(100)]],
      templateId: ['', Validators.required],
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

    // Load template totals when templates are loaded
    effect(() => {
      const templates = this.templateSelection.filteredTemplates();
      templates.forEach((template) => {
        this.loadTemplateTotal(template.id);
      });
    });
  }

  private async loadTemplateTotal(templateId: string): Promise<void> {
    // Check if already loading or loaded
    const current = this.templateTotals()[templateId];
    if (current) {
      return;
    }

    // Set loading state
    this.templateTotals.update((totals) => ({
      ...totals,
      [templateId]: {
        totalIncome: 0,
        totalExpenses: 0,
        loading: true,
      },
    }));

    try {
      // Load template lines
      const lines =
        await this.templateSelection.loadTemplateDetails(templateId);
      const totals = this.templateSelection.calculateTemplateTotals(lines);

      // Update totals
      this.templateTotals.update((current) => ({
        ...current,
        [templateId]: { ...totals, loading: false },
      }));
    } catch {
      // Set error state (show 0 values)
      this.templateTotals.update((current) => ({
        ...current,
        [templateId]: {
          totalIncome: 0,
          totalExpenses: 0,
          loading: false,
        },
      }));
    }
  }

  onMonthSelected(
    normalizedMonthAndYear: Date,
    datePicker: { close: () => void },
  ): void {
    this.#formState.setMonthAndYear(this.budgetForm, normalizedMonthAndYear);
    datePicker.close();
  }

  onTemplateSelect(templateId: string): void {
    this.templateSelection.selectTemplate(templateId);
  }

  showTemplateDetails(template: BudgetTemplate): void {
    this.#dialog.open(TemplateDetailsDialog, {
      data: { template },
      width: '600px',
      maxWidth: '90vw',
      maxHeight: '80vh',
      autoFocus: 'first-tabbable',
    });
  }

  onCreateBudget(): void {
    const formData = this.#formState.validateAndGetFormData(this.budgetForm);
    if (formData && this.templateSelection.selectedTemplate()) {
      this.#dialogRef.close(formData);
    }
  }
}
