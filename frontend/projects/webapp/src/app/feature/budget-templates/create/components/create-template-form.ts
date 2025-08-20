import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  ReactiveFormsModule,
  type ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { type BudgetTemplateCreate } from '@pulpe/shared';
import { BudgetTemplatesState } from '../../services/budget-templates-state';
import { DefaultWarningPanel } from '../ui/default-warning-panel';
import {
  duplicateNameValidator,
  getTemplateNameErrorMessage,
} from './template-validators';

@Component({
  selector: 'pulpe-create-template-form',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDividerModule,
    DefaultWarningPanel,
  ],
  template: `
    @if (state.budgetTemplates.isLoading()) {
      <div class="flex justify-center items-center py-16">
        <mat-spinner diameter="40"></mat-spinner>
      </div>
    } @else {
      <div
        class="relative space-y-4 md:space-y-6"
        data-testid="template-form-container"
      >
        <!-- Loading overlay during form submission -->
        @if (isCreating()) {
          <div
            class="absolute inset-0 bg-surface/50 flex items-center justify-center z-10 rounded-corner-medium"
          >
            <div class="flex flex-col items-center gap-3">
              <mat-spinner diameter="32"></mat-spinner>
              <span
                class="text-body-medium text-on-surface-variant font-medium"
              >
                Création en cours...
              </span>
            </div>
          </div>
        }

        @if (state.templateCount() > 0) {
          <div class="text-body-medium text-on-surface-variant">
            {{ state.templateCount() }}/{{ state.MAX_TEMPLATES }} modèles créés
          </div>
        }

        <form
          [formGroup]="templateForm"
          (ngSubmit)="onSubmit()"
          (keydown.escape)="onEscapeKey()"
          data-testid="template-form"
        >
          <!-- Grid container with responsive columns and MD3 spacing -->
          <div class="flex flex-col gap-4 md:gap-6 pt-4">
            <!-- Name field - full width for optimal UX -->
            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Nom du modèle</mat-label>
              <input
                matInput
                formControlName="name"
                required
                [maxlength]="50"
                data-testid="template-name-input"
              />
              <mat-hint align="end">
                {{ templateForm.get('name')?.value?.length }}/{{ 50 }}
              </mat-hint>
              @if (this.templateForm.get('name')?.errors) {
                <mat-error data-testid="name-error" id="name-error-message">
                  {{
                    getTemplateNameErrorMessage(
                      this.templateForm.get('name')?.errors ?? null
                    )
                  }}
                </mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Description (optionnelle)</mat-label>
              <textarea
                matInput
                formControlName="description"
                rows="3"
                aria-label="Description du modèle (optionnel)"
                data-testid="template-description-input"
              ></textarea>
              <mat-hint align="end">
                {{ templateForm.get('description')?.value?.length }}/{{ 200 }}
              </mat-hint>
              @if (templateForm.get('description')?.errors) {
                <mat-error>
                  @if (templateForm.get('description')?.errors?.['maxlength']) {
                    La description ne doit pas dépasser 200 caractères.
                  }
                </mat-error>
              }
            </mat-form-field>

            <div class="flex items-center gap-2">
              <mat-checkbox
                formControlName="isDefault"
                data-testid="template-default-checkbox"
                aria-label="Définir comme modèle par défaut"
                class="min-h-[44px] flex items-center"
              >
                Modèle par défaut
              </mat-checkbox>
              <mat-icon
                matTooltip="Le modèle par défaut est sélectionné par défaut pour créer de nouveaux budgets mensuels."
                matTooltipPosition="above"
                aria-label="Information sur le modèle par défaut"
                class="!text-on-surface-variant cursor-help"
                tabindex="0"
              >
                info
              </mat-icon>
            </div>

            <!-- Default warning panel -->
            @if (overrideDefaultTemplateWarningMessage(); as warningMessage) {
              <div class="col-span-1">
                <pulpe-default-warning-panel
                  id="default-warning"
                  [message]="warningMessage"
                />
              </div>
            }

            <!-- Enhanced error message section -->
            @if (globalFormError(); as errorMessage) {
              <div class="col-span-1">
                <div
                  class="p-4 bg-error-container text-on-error-container rounded-corner-medium flex items-start gap-3"
                  role="alert"
                  aria-live="assertive"
                >
                  <mat-icon class="text-on-error-container flex-shrink-0 mt-0.5"
                    >error</mat-icon
                  >
                  <span class="text-body-medium leading-relaxed">
                    {{ errorMessage }}
                  </span>
                </div>
              </div>
            }

            <!-- Template limit information -->
            @if (state.isTemplateLimitReached()) {
              <div class="col-span-1">
                <div
                  id="limit-reached-info"
                  class="p-4 bg-error-container text-on-error-container rounded-corner-medium flex items-start gap-3"
                  role="status"
                  aria-live="polite"
                >
                  <mat-icon class="text-on-error-container flex-shrink-0 mt-0.5"
                    >warning</mat-icon
                  >
                  <span class="text-body-medium leading-relaxed">
                    Limite de {{ state.MAX_TEMPLATES }} modèles atteinte.
                    Supprimez un modèle existant pour en créer un nouveau.
                  </span>
                </div>
              </div>
            }
          </div>

          <!-- Divider to separate form from actions -->
          <mat-divider class="!mt-4 !mb-4" />

          <!-- Action buttons aligned right with mobile-first responsive layout -->
          <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              matButton
              (click)="cancelForm.emit()"
              [disabled]="isCreating()"
              data-testid="cancel-button"
              type="button"
            >
              Annuler
            </button>
            <button
              matButton="filled"
              type="submit"
              [disabled]="!isFormValidForSubmission()"
              data-testid="submit-button"
            >
              {{ submitButtonText() }}
            </button>
          </div>
        </form>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateTemplateForm {
  // Injected dependencies
  #fb = inject(FormBuilder);
  protected state = inject(BudgetTemplatesState);

  isCreating = input(false);

  addTemplate = output<BudgetTemplateCreate>();
  cancelForm = output<void>();
  formReset = output<void>();

  globalFormError = signal<string | null>(null);
  templateForm = this.#fb.group({
    name: [
      '',
      {
        validators: [
          Validators.required,
          Validators.maxLength(50),
          duplicateNameValidator(
            this.state.budgetTemplates
              .value()
              ?.map((t) => t.name.toLowerCase()),
          ),
        ],
      },
    ],
    description: ['', [Validators.maxLength(200)]],
    isDefault: [false],
  });

  formValues = toSignal(this.templateForm.valueChanges, {
    initialValue: this.templateForm.getRawValue(),
  });
  formStatus = toSignal(this.templateForm.statusChanges, {
    initialValue: this.templateForm.status,
  });
  isFormValid = computed(() => this.formStatus() === 'VALID');

  // Computed signals reading from consolidated formValues
  isDefaultChecked = computed(() => this.formValues()?.isDefault ?? false);

  overrideDefaultTemplateWarningMessage = linkedSignal(() => {
    const defaultTemplate = this.state.defaultBudgetTemplate();
    const isDefaultChecked = this.isDefaultChecked();

    if (!!defaultTemplate && isDefaultChecked) {
      return `Le modèle "${defaultTemplate.name}" ne sera plus le modèle par défaut.`;
    }

    return null;
  });

  // Smart submit button state management
  submitButtonText = computed(() => {
    const isCreating = this.isCreating();
    const isTemplateLimitReached = this.state.isTemplateLimitReached();
    if (isCreating) return 'Création...';
    if (isTemplateLimitReached) return 'Limite atteinte';
    return 'Créer';
  });

  isFormValidForSubmission = computed(() => {
    const isFormValid = this.isFormValid();
    const isPending = this.isCreating();
    const isTemplateLimitReached = this.state.isTemplateLimitReached();
    return isFormValid && !isPending && !isTemplateLimitReached;
  });

  constructor() {
    // Effect to disable/enable form fields based on isCreating signal
    effect(() => {
      if (this.isCreating()) {
        this.templateForm.disable();
      } else {
        this.templateForm.enable();
      }
    });

    effect(() => {
      const templates = this.state.budgetTemplates.value();
      this.templateForm
        .get('name')
        ?.setValidators([
          Validators.required,
          Validators.maxLength(50),
          duplicateNameValidator(templates?.map((t) => t.name.toLowerCase())),
        ]);
      this.templateForm.get('name')?.updateValueAndValidity();
    });
  }

  onSubmit() {
    this.templateForm.markAllAsTouched();
    if (!this.isFormValidForSubmission()) {
      if (this.state.isTemplateLimitReached()) {
        this.globalFormError.set(
          `Vous avez atteint la limite de ${this.state.MAX_TEMPLATES} modèles`,
        );
      }
      return;
    }

    // Form is valid, create template from form values
    const formVal = this.formValues();
    const template: BudgetTemplateCreate = {
      name: formVal?.name?.trim() ?? '',
      description: formVal?.description?.trim() || undefined,
      isDefault: formVal?.isDefault ?? false,
      lines: [],
    };

    this.addTemplate.emit(template);
    // Reset form immediately after successful submission
    this.resetForm();
  }

  // Enhanced form reset with better UX
  resetForm() {
    this.templateForm.reset();
    this.templateForm.markAsUntouched();
    this.templateForm.markAsPristine();

    this.formReset.emit();
  }

  // Enhanced keyboard navigation
  onEscapeKey() {
    if (!this.isCreating()) {
      this.cancelForm.emit();
    }
  }

  getTemplateNameErrorMessage(errors: ValidationErrors | null): string | null {
    return getTemplateNameErrorMessage(errors);
  }
}
