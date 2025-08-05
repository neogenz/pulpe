import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  inject,
  computed,
  OnInit,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
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
  ],
  template: `
    @if (state.isLoading() && state.templatesData.status() === 'loading') {
      <div class="flex justify-center items-center py-16">
        <mat-spinner diameter="40"></mat-spinner>
      </div>
    } @else {
      <div class="space-y-6" data-testid="template-form-container">
        @if (state.templateCount() > 0) {
          <div class="text-body-medium text-on-surface-variant">
            {{ state.templateCount() }}/{{ state.MAX_TEMPLATES }} modèles créés
          </div>
        }

        <form
          [formGroup]="templateForm"
          (ngSubmit)="onSubmit()"
          data-testid="template-form"
          class="space-y-6"
        >
          <div class="space-y-4">
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

            @if (state.businessError()) {
              <div
                class="p-3 surface-error-container rounded-md flex items-center gap-2"
              >
                <mat-icon class="text-error">error</mat-icon>
                <span class="text-error text-body-medium">
                  {{ state.businessError() }}
                </span>
              </div>
            }
          </div>

          <div class="flex justify-end gap-3 pt-4">
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
              [disabled]="
                templateForm.invalid || isCreating() || !state.canCreateMore()
              "
              data-testid="submit-button"
            >
              {{ isCreating() ? 'Création...' : 'Créer' }}
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

  ngOnInit() {
    // Load templates to check count and default status
    if (this.state.templatesData.status() === 'idle') {
      this.state.refreshData();
    }
  }

  onSubmit() {
    if (this.templateForm.valid && this.state.canCreateMore()) {
      const formValue = this.templateForm.value;

      const template: BudgetTemplateCreate = {
        name: formValue.name || '',
        description: formValue.description || undefined,
        isDefault: formValue.isDefault ?? false,
        lines: [],
      };
      this.addTemplate.emit(template);
      this.templateForm.reset();
    } else if (!this.state.canCreateMore()) {
      this.state.businessError.set(
        `Vous avez atteint la limite de ${this.state.MAX_TEMPLATES} modèles`,
      );
    }
  }
}
