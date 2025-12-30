import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
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
import { DefaultWarningPanel } from '../ui/default-warning-panel';
import {
  duplicateNameValidator,
  getTemplateNameErrorMessage,
} from './template-validators';

const MAX_TEMPLATES = 5;

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
            <span class="text-body-medium text-on-surface-variant font-medium">
              Création en cours...
            </span>
          </div>
        </div>
      }

      @if (templateCount() > 0) {
        <div class="text-body-medium text-on-surface-variant">
          {{ templateCount() }}/{{ maxTemplates }} modèles créés
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
          @if (overrideDefaultWarning(); as warningMessage) {
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
          @if (isLimitReached()) {
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
                  Limite de {{ maxTemplates }} modèles atteinte. Supprimez un
                  modèle existant pour en créer un nouveau.
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
            data-testid="template-submit-button"
          >
            {{ submitButtonText() }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateTemplateForm {
  #fb = inject(FormBuilder);

  // All data comes via inputs - NO state injection
  isCreating = input(false);
  templateCount = input(0);
  existingTemplateNames = input<string[]>([]);
  defaultTemplateName = input<string | null>(null);

  // Outputs
  addTemplate = output<BudgetTemplateCreate>();
  cancelForm = output<void>();

  // Constants
  readonly maxTemplates = MAX_TEMPLATES;

  // Local state
  globalFormError = signal<string | null>(null);

  // Form definition - validators set initially, updated via effect when inputs change
  templateForm = this.#fb.group({
    name: [
      '',
      {
        validators: [Validators.required, Validators.maxLength(50)],
      },
    ],
    description: ['', [Validators.maxLength(200)]],
    isDefault: [false],
  });

  // Form signals
  formValues = toSignal(this.templateForm.valueChanges, {
    initialValue: this.templateForm.getRawValue(),
  });
  formStatus = toSignal(this.templateForm.statusChanges, {
    initialValue: this.templateForm.status,
  });
  isFormValid = computed(() => this.formStatus() === 'VALID');
  isDefaultChecked = computed(() => this.formValues()?.isDefault ?? false);

  // Computed: limit reached based on input (hidden during creation to avoid flicker)
  isLimitReached = computed(
    () => !this.isCreating() && this.templateCount() >= this.maxTemplates,
  );

  // Computed: warning message when overriding default
  overrideDefaultWarning = computed(() => {
    const defaultName = this.defaultTemplateName();
    const isDefaultChecked = this.isDefaultChecked();

    if (defaultName && isDefaultChecked) {
      return `Le modèle "${defaultName}" ne sera plus le modèle par défaut.`;
    }
    return null;
  });

  // Submit button text
  submitButtonText = computed(() => {
    if (this.isCreating()) return 'Création...';
    if (this.isLimitReached()) return 'Limite atteinte';
    return 'Créer';
  });

  // Form valid for submission
  isFormValidForSubmission = computed(() => {
    return this.isFormValid() && !this.isCreating() && !this.isLimitReached();
  });

  constructor() {
    // Effect: disable form when creating
    effect(() => {
      if (this.isCreating()) {
        this.templateForm.disable();
      } else {
        this.templateForm.enable();
      }
    });

    // Effect: update validators when existingTemplateNames input changes
    effect(() => {
      const existingNames = this.existingTemplateNames();
      this.templateForm
        .get('name')
        ?.setValidators([
          Validators.required,
          Validators.maxLength(50),
          duplicateNameValidator(existingNames),
        ]);
      // Only update validity if form is not being created (to avoid flicker)
      if (!this.isCreating()) {
        this.templateForm.get('name')?.updateValueAndValidity();
      }
    });
  }

  onSubmit() {
    this.templateForm.markAllAsTouched();
    if (!this.isFormValidForSubmission()) {
      if (this.isLimitReached()) {
        this.globalFormError.set(
          `Vous avez atteint la limite de ${this.maxTemplates} modèles`,
        );
      }
      return;
    }

    const formVal = this.formValues();
    const template: BudgetTemplateCreate = {
      name: formVal?.name?.trim() ?? '',
      description: formVal?.description?.trim() || undefined,
      isDefault: formVal?.isDefault ?? false,
      lines: [],
    };

    this.addTemplate.emit(template);
  }

  onEscapeKey() {
    if (!this.isCreating()) {
      this.cancelForm.emit();
    }
  }

  getTemplateNameErrorMessage(errors: ValidationErrors | null): string | null {
    return getTemplateNameErrorMessage(errors);
  }
}
