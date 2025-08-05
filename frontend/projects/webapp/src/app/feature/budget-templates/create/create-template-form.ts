import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  inject,
  computed,
  OnInit,
  effect,
  signal,
  viewChild,
  ElementRef,
  afterNextRender,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { map, startWith } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { type BudgetTemplateCreate } from '@pulpe/shared';
import { BudgetTemplatesState } from '../services/budget-templates-state';

// Constants
const FORM_LIMITS = {
  NAME_MAX_LENGTH: 100,
  DESCRIPTION_MAX_LENGTH: 500,
} as const;

const VALIDATION_MESSAGES = {
  NAME_REQUIRED: 'Le nom est requis',
  NAME_DUPLICATE: 'Un modèle avec ce nom existe déjà',
  TEMPLATE_LIMIT_REACHED: (max: number) =>
    `Vous avez atteint la limite de ${max} modèles`,
} as const;

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
  ],
  template: `
    @if (state.isLoading() && state.templatesData.status() === 'loading') {
      <div class="flex justify-center items-center py-16">
        <mat-spinner diameter="40"></mat-spinner>
      </div>
    } @else {
      <div
        class="relative space-y-4 md:space-y-6"
        data-testid="template-form-container"
      >
        <!-- Loading overlay during form submission -->
        @if (shouldShowSpinner()) {
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
          <div class="grid grid-cols-1 gap-4 md:gap-6 pt-4">
            <!-- Name field - full width for optimal UX -->
            <div class="col-span-1">
              <mat-form-field appearance="fill" class="w-full">
                <mat-label>Nom du modèle</mat-label>
                <input
                  matInput
                  formControlName="name"
                  required
                  [maxlength]="FORM_LIMITS.NAME_MAX_LENGTH"
                  [attr.aria-describedby]="
                    nameValidationError() ? 'name-error-message' : null
                  "
                  data-testid="template-name-input"
                  #nameInput
                />
                <mat-hint align="end">
                  {{ nameLength() }}/{{ FORM_LIMITS.NAME_MAX_LENGTH }}
                </mat-hint>
                @if (nameValidationError()) {
                  <mat-error data-testid="name-error" id="name-error-message">
                    {{ nameValidationError() }}
                  </mat-error>
                }
              </mat-form-field>
            </div>

            <!-- Description field - full width for textarea UX -->
            <div class="col-span-1">
              <mat-form-field appearance="fill" class="w-full">
                <mat-label>Description (optionnelle)</mat-label>
                <textarea
                  matInput
                  formControlName="description"
                  rows="3"
                  [maxlength]="FORM_LIMITS.DESCRIPTION_MAX_LENGTH"
                  aria-label="Description du modèle (optionnel)"
                  data-testid="template-description-input"
                ></textarea>
                <mat-hint align="end">
                  {{ descriptionLength() }}/{{
                    FORM_LIMITS.DESCRIPTION_MAX_LENGTH
                  }}
                </mat-hint>
              </mat-form-field>
            </div>

            <!-- Checkbox section - full width with proper touch target -->
            <div class="col-span-1">
              <mat-checkbox
                formControlName="isDefault"
                data-testid="template-default-checkbox"
                [attr.aria-describedby]="
                  showDefaultWarning() ? 'default-warning' : null
                "
                aria-label="Définir comme modèle par défaut"
                class="min-h-[44px] flex items-center w-full"
              >
                Modèle par défaut
              </mat-checkbox>
            </div>

            <!-- Material Design 3 Info Panel - separate row -->
            @if (showDefaultWarning()) {
              <div class="col-span-1">
                <div
                  id="default-warning"
                  class="p-4 rounded-corner-medium bg-secondary-container text-on-secondary-container flex items-center gap-3"
                  role="alert"
                  aria-live="polite"
                >
                  <mat-icon
                    class="text-on-secondary-container flex-shrink-0 mt-0.5"
                    aria-hidden="true"
                  >
                    info
                  </mat-icon>

                  <p class="text-body-medium flex-1 m-0 leading-relaxed">
                    Le modèle
                    <span class="font-medium"
                      >"{{ state.currentDefaultTemplate()?.name }}"</span
                    >
                    ne sera plus le modèle par défaut. Ce nouveau modèle le
                    remplacera.
                  </p>

                  <button
                    matIconButton
                    (click)="dismissDefaultWarning()"
                    aria-label="Fermer l'information"
                    class="flex-shrink-0"
                  >
                    <mat-icon>close</mat-icon>
                  </button>
                </div>
              </div>
            }

            <!-- Enhanced error message section -->
            @if (state.businessError()) {
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
                    {{ state.businessError() }}
                  </span>
                </div>
              </div>
            }

            <!-- Template limit information -->
            @if (!state.canCreateMore()) {
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
              [disabled]="isFormDisabled()"
              data-testid="cancel-button"
              type="button"
              class="min-h-[44px] w-full sm:w-auto"
              [attr.aria-label]="
                isFormDisabled()
                  ? 'Annulation indisponible pendant la création'
                  : 'Annuler la création'
              "
            >
              Annuler
            </button>
            <button
              matButton="filled"
              type="submit"
              [disabled]="!isFormValidForSubmission()"
              [attr.aria-describedby]="
                !state.canCreateMore() ? 'limit-reached-info' : null
              "
              [attr.aria-label]="getSubmitButtonAriaLabel()"
              data-testid="submit-button"
              class="min-h-[44px] w-full sm:w-auto"
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
export class CreateTemplateForm implements OnInit {
  // Injected dependencies
  #fb = inject(FormBuilder);
  protected state = inject(BudgetTemplatesState);

  // ViewChild reference for the name input
  nameInputRef = viewChild<ElementRef<HTMLInputElement>>('nameInput');

  // Inputs
  isCreating = input(false);

  // Outputs
  addTemplate = output<BudgetTemplateCreate>();
  cancelForm = output<void>();
  formReset = output<void>();

  // Properties
  templateForm = this.#fb.group({
    name: [
      '',
      [Validators.required, Validators.maxLength(FORM_LIMITS.NAME_MAX_LENGTH)],
    ],
    description: [
      '',
      [Validators.maxLength(FORM_LIMITS.DESCRIPTION_MAX_LENGTH)],
    ],
    isDefault: [false],
  });

  // Expose constants for template
  protected FORM_LIMITS = FORM_LIMITS;
  protected VALIDATION_MESSAGES = VALIDATION_MESSAGES;

  // 🎯 SOLUTION: Reactive form values using toSignal for proper reactivity
  nameValue = toSignal(
    this.templateForm.get('name')!.valueChanges.pipe(
      startWith(this.templateForm.get('name')!.value),
      map((value) => value ?? ''),
    ),
    { initialValue: '' },
  );
  nameLength = computed(() => this.nameValue().length);

  descriptionValue = toSignal(
    this.templateForm.get('description')!.valueChanges.pipe(
      startWith(this.templateForm.get('description')!.value),
      map((value) => value ?? ''),
    ),
    { initialValue: '' },
  );
  descriptionLength = computed(() => this.descriptionValue().length);

  isDefaultValue = toSignal(
    this.templateForm.get('isDefault')!.valueChanges.pipe(
      startWith(this.templateForm.get('isDefault')!.value),
      map((value) => value ?? false),
    ),
    { initialValue: false },
  );

  // Panel dismissal state
  #warningDismissed = signal(false);

  // Business logic computed signals
  showDefaultWarning = computed(() => {
    const hasDefault = this.state.hasDefaultTemplate();
    const isChecked = this.isDefaultValue(); // Now properly reactive!
    const isDismissed = this.#warningDismissed();

    return hasDefault && isChecked && !isDismissed;
  });

  // Simplified name validation - only show errors when touched
  nameValidationError = computed(() => {
    const name = this.nameValue();
    const nameControl = this.templateForm.get('name');

    // Only show errors if field has been touched
    if (!nameControl?.touched) {
      return null;
    }

    if (!name.trim()) {
      return VALIDATION_MESSAGES.NAME_REQUIRED;
    }

    // Check for duplicate names only if templates are loaded
    if (this.state.templatesData.status() === 'resolved') {
      const existingNames =
        this.state.templatesData.value()?.map((t) => t.name.toLowerCase()) ??
        [];
      if (existingNames.includes(name.trim().toLowerCase())) {
        return VALIDATION_MESSAGES.NAME_DUPLICATE;
      }
    }

    return null;
  });

  // Enhanced form state signals
  isFormDisabled = computed(() => this.isCreating());

  // Smart submit button state management
  submitButtonText = computed(() => {
    if (this.isCreating()) return 'Création...';
    if (!this.state.canCreateMore()) return 'Limite atteinte';
    return 'Créer';
  });

  shouldShowSpinner = computed(() => this.isCreating());

  // Simplified form validation - KISS principle
  isFormValidForSubmission = computed(() => {
    const nameValue = this.nameValue().trim();
    const isFormValid = this.templateForm.valid;
    const canCreate = this.state.canCreateMore();
    const notCreating = !this.isCreating();

    return nameValue.length > 0 && isFormValid && canCreate && notCreating;
  });

  constructor() {
    // Effect to disable/enable form fields based on isCreating signal
    effect(() => {
      if (this.isCreating()) {
        this.templateForm.disable();
      } else {
        this.templateForm.enable();
        // Form is enabled, no need to disable checkbox anymore
      }
    });

    // Effect to reset warning dismissal when isDefault changes
    effect(() => {
      this.isDefaultValue(); // Track the signal
      this.#warningDismissed.set(false); // Reset dismissal when checkbox changes
    });
  }

  ngOnInit() {
    // Load templates to check count and default status
    if (this.state.templatesData.status() === 'idle') {
      this.state.refreshData();
    }
  }

  onSubmit() {
    // Mark all fields as touched to show validation errors
    this.templateForm.markAllAsTouched();

    if (!this.validateForm()) {
      // Focus on first invalid field for accessibility
      this.focusFirstInvalidField();
      return;
    }

    const name = this.nameValue();
    if (!name.trim()) {
      this.state.businessError.set(VALIDATION_MESSAGES.NAME_REQUIRED);
      return;
    }

    const template: BudgetTemplateCreate = {
      name: name.trim(),
      description: this.descriptionValue().trim() || undefined,
      isDefault: this.isDefaultValue(),
      lines: [],
    };

    this.addTemplate.emit(template);
    // Reset form immediately after successful submission
    this.resetForm();
  }

  private focusFirstInvalidField(): void {
    // Enhanced accessibility: focus on first invalid field
    const nameControl = this.templateForm.get('name');
    if (nameControl?.invalid || this.nameValidationError()) {
      this.focusNameInput();
    }
  }

  private validateForm(): boolean {
    this.state.businessError.set(null);

    if (!this.templateForm.valid) {
      return false;
    }

    if (!this.state.canCreateMore()) {
      this.state.businessError.set(
        VALIDATION_MESSAGES.TEMPLATE_LIMIT_REACHED(this.state.MAX_TEMPLATES),
      );
      return false;
    }

    if (this.isCreating()) {
      return false;
    }

    return true;
  }

  // Enhanced form reset with better UX
  resetForm() {
    this.templateForm.reset();
    this.templateForm.markAsUntouched();
    this.templateForm.markAsPristine();
    this.#warningDismissed.set(false); // Reset warning dismissal when form resets
    this.state.businessError.set(null); // Clear any business errors

    // Focus on name field after reset for better UX
    this.focusNameInput();

    this.formReset.emit();
  }

  private focusNameInput(): void {
    // Use afterNextRender to ensure the element is available and properly focused
    afterNextRender(() => {
      const inputElement = this.nameInputRef()?.nativeElement;
      if (inputElement) {
        inputElement.focus();
      }
    });
  }

  // Method to dismiss the default warning panel
  dismissDefaultWarning() {
    this.#warningDismissed.set(true);
  }

  // Enhanced keyboard navigation
  onEscapeKey() {
    if (!this.isCreating()) {
      this.cancelForm.emit();
    }
  }

  // Accessibility helper for submit button
  getSubmitButtonAriaLabel(): string {
    if (this.isCreating()) {
      return 'Création du modèle en cours, veuillez patienter';
    }
    if (!this.state.canCreateMore()) {
      return 'Création impossible, limite de modèles atteinte';
    }
    if (!this.isFormValidForSubmission()) {
      return 'Créer le modèle (formulaire invalide)';
    }
    return 'Créer le modèle de budget';
  }
}
