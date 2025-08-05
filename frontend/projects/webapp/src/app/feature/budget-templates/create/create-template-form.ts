import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  inject,
  computed,
  OnInit,
  effect,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
      <div class="relative space-y-6" data-testid="template-form-container">
        <!-- Loading overlay during form submission -->
        @if (shouldShowSpinner()) {
          <div
            class="absolute inset-0 bg-surface bg-opacity-50 flex items-center justify-center z-10 rounded-md"
          >
            <div class="flex flex-col items-center gap-2">
              <mat-spinner diameter="32"></mat-spinner>
              <span class="text-body-small text-on-surface-variant">
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
          data-testid="template-form"
        >
          <!-- Grid container with responsive columns -->
          <div class="grid grid-cols-1 gap-4 md:gap-6 py-4">
            <!-- Name field - full width for optimal UX -->
            <div class="col-span-1">
              <mat-form-field appearance="outline" class="w-full">
                <mat-label>Nom du modèle</mat-label>
                <input
                  matInput
                  formControlName="name"
                  required
                  maxlength="100"
                  data-testid="template-name-input"
                />
                <mat-hint align="end">
                  {{ templateForm.get('name')?.value?.length || 0 }}/100
                </mat-hint>
                @if (
                  templateForm.get('name')?.invalid &&
                  templateForm.get('name')?.touched
                ) {
                  <mat-error data-testid="name-error">
                    Le nom est requis
                  </mat-error>
                }
              </mat-form-field>
            </div>

            <!-- Description field - full width for textarea UX -->
            <div class="col-span-1">
              <mat-form-field appearance="outline" class="w-full">
                <mat-label>Description (optionnelle)</mat-label>
                <textarea
                  matInput
                  formControlName="description"
                  rows="3"
                  maxlength="500"
                  data-testid="template-description-input"
                ></textarea>
                <mat-hint align="end">
                  {{ templateForm.get('description')?.value?.length || 0 }}/500
                </mat-hint>
              </mat-form-field>
            </div>

            <!-- Checkbox section - full width -->
            <div class="col-span-1">
              <div class="flex items-center gap-2">
                <mat-checkbox
                  formControlName="isDefault"
                  [disabled]="hasDefaultAndNotThis()"
                  data-testid="template-default-checkbox"
                >
                  Modèle par défaut
                </mat-checkbox>
                @if (hasDefaultAndNotThis()) {
                  <mat-icon
                    class="text-body-small"
                    [matTooltip]="
                      'Un modèle par défaut existe déjà: ' +
                      state.currentDefaultTemplate()?.name
                    "
                  >
                    info
                  </mat-icon>
                }
              </div>
            </div>

            <!-- Error message section -->
            @if (state.businessError()) {
              <div class="col-span-1">
                <div
                  class="p-3 surface-error-container rounded-md flex items-center gap-2"
                >
                  <mat-icon class="text-error">error</mat-icon>
                  <span class="text-error text-body-medium">
                    {{ state.businessError() }}
                  </span>
                </div>
              </div>
            }
          </div>

          <!-- Divider to separate form from actions -->
          <mat-divider class="!mt-4 !mb-4" />

          <!-- Action buttons aligned right -->
          <div class="flex justify-end gap-3">
            <button
              matButton
              (click)="cancelForm.emit()"
              [disabled]="isFormDisabled()"
              data-testid="cancel-button"
              type="button"
            >
              Annuler
            </button>
            <button
              matButton="filled"
              type="submit"
              [disabled]="
                templateForm.invalid ||
                isFormDisabled() ||
                !state.canCreateMore()
              "
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
export class CreateTemplateForm implements OnInit {
  #fb = inject(FormBuilder);
  protected readonly state = inject(BudgetTemplatesState);

  isCreating = input(false);
  addTemplate = output<BudgetTemplateCreate>();
  cancelForm = output<void>();

  templateForm = this.#fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', [Validators.maxLength(500)]],
    isDefault: [false],
  });

  // Check if there's a default template and this form isn't editing it
  hasDefaultAndNotThis = computed(() => {
    return (
      this.state.hasDefaultTemplate() &&
      !this.templateForm.get('isDefault')?.value
    );
  });

  // Computed signals for derived UI states
  isFormDisabled = computed(() => this.isCreating());
  submitButtonText = computed(() =>
    this.isCreating() ? 'Création...' : 'Créer',
  );
  shouldShowSpinner = computed(() => this.isCreating());

  constructor() {
    // Effect to disable/enable form fields based on isCreating signal
    effect(() => {
      if (this.isCreating()) {
        this.templateForm.disable();
      } else {
        this.templateForm.enable();
        // Re-apply checkbox disabled state based on business logic
        if (this.hasDefaultAndNotThis()) {
          this.templateForm.get('isDefault')?.disable();
        }
      }
    });
  }

  ngOnInit() {
    // Load templates to check count and default status
    if (this.state.templatesData.status() === 'idle') {
      this.state.refreshData();
    }
  }

  onSubmit() {
    if (
      this.templateForm.valid &&
      this.state.canCreateMore() &&
      !this.isCreating()
    ) {
      const formValue = this.templateForm.value;

      const template: BudgetTemplateCreate = {
        name: formValue.name || '',
        description: formValue.description || undefined,
        isDefault: formValue.isDefault ?? false,
        lines: [],
      };
      this.addTemplate.emit(template);
      // Note: Form reset is now handled by parent component after successful navigation
    } else if (!this.state.canCreateMore()) {
      this.state.businessError.set(
        `Vous avez atteint la limite de ${this.state.MAX_TEMPLATES} modèles`,
      );
    }
  }

  // Method to reset form - called by parent on successful creation
  resetForm() {
    this.templateForm.reset();
    this.templateForm.markAsUntouched();
    this.templateForm.markAsPristine();
  }
}
