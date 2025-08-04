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
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { type BudgetTemplateCreate } from '@pulpe/shared';
import { BudgetTemplatesState } from '../../services/budget-templates-state';

@Component({
  selector: 'pulpe-create-template-form',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
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
      <mat-card class="surface-container-highest">
        <mat-card-content class="flex justify-center items-center py-8">
          <mat-spinner diameter="40"></mat-spinner>
        </mat-card-content>
      </mat-card>
    } @else {
      <mat-card
        class="surface-container-highest"
        data-testid="template-form-card"
      >
        <mat-card-header>
          <mat-card-title data-testid="form-title"
            >Nouveau modèle de budget</mat-card-title
          >
          @if (state.templateCount() > 0) {
            <mat-card-subtitle class="text-body-medium">
              {{ state.templateCount() }}/{{ state.MAX_TEMPLATES }} modèles
              créés
            </mat-card-subtitle>
          }
        </mat-card-header>
        <form
          [formGroup]="templateForm"
          (ngSubmit)="onSubmit()"
          data-testid="template-form"
        >
          <mat-card-content class="space-y-4">
            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Nom du modèle</mat-label>
              <input
                matInput
                formControlName="name"
                required
                maxlength="100"
                data-testid="template-name-input"
              />
              <mat-hint align="end"
                >{{ nameControl?.value?.length || 0 }}/100</mat-hint
              >
              @if (
                templateForm.get('name')?.invalid &&
                templateForm.get('name')?.touched
              ) {
                @if (templateForm.get('name')?.errors?.['required']) {
                  <mat-error data-testid="name-error"
                    >Le nom est requis</mat-error
                  >
                }
              }
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Description</mat-label>
              <textarea
                matInput
                formControlName="description"
                rows="3"
                maxlength="500"
                data-testid="template-description-input"
              ></textarea>
              <mat-hint align="end"
                >{{ descriptionControl?.value?.length || 0 }}/500</mat-hint
              >
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
                class="mt-4 p-3 surface-error-container rounded-md flex items-center gap-2"
              >
                <mat-icon class="text-error">error</mat-icon>
                <span class="text-error text-body-medium">{{
                  state.businessError()
                }}</span>
              </div>
            }
          </mat-card-content>

          <mat-card-actions align="end">
            <button
              matButton
              (click)="cancelForm.emit()"
              [disabled]="isCreating()"
              data-testid="cancel-button"
            >
              Annuler
            </button>
            <button
              matButton="filled"
              type="submit"
              [disabled]="templateForm.invalid || isCreating()"
              data-testid="submit-button"
            >
              {{ isCreating() ? 'Création...' : 'Créer' }}
            </button>
          </mat-card-actions>
        </form>
      </mat-card>
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
  #fb = new FormBuilder();
  protected readonly state = inject(BudgetTemplatesState);

  isCreating = input(false);
  addTemplate = output<BudgetTemplateCreate>();
  cancelForm = output<void>();

  // Form controls getters for template access
  get nameControl() {
    return this.templateForm.get('name');
  }
  get descriptionControl() {
    return this.templateForm.get('description');
  }

  templateForm = this.#fb.group({
    name: [
      '',
      [Validators.required, Validators.minLength(1), Validators.maxLength(100)],
    ],
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
