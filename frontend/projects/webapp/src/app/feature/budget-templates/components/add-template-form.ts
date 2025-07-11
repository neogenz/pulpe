import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { type BudgetTemplateCreate } from '@pulpe/shared';

@Component({
  selector: 'pulpe-add-template-form',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
  ],
  template: `
    <mat-card data-testid="template-form-card">
      <mat-card-header>
        <mat-card-title data-testid="form-title"
          >Nouveau modèle de budget</mat-card-title
        >
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
              data-testid="template-name-input"
            />
            @if (
              templateForm.get('name')?.invalid &&
              templateForm.get('name')?.touched
            ) {
              <mat-error data-testid="name-error">Le nom est requis</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Description</mat-label>
            <textarea
              matInput
              formControlName="description"
              rows="3"
              data-testid="template-description-input"
            ></textarea>
          </mat-form-field>

          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Catégorie</mat-label>
            <input
              matInput
              formControlName="category"
              data-testid="template-category-input"
            />
          </mat-form-field>

          <mat-checkbox
            formControlName="isDefault"
            data-testid="template-default-checkbox"
          >
            Modèle par défaut
          </mat-checkbox>
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
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTemplateForm {
  #fb = new FormBuilder();

  isCreating = input(false);
  addTemplate = output<BudgetTemplateCreate>();
  cancelForm = output<void>();

  templateForm = this.#fb.group({
    name: ['', [Validators.required, Validators.minLength(1)]],
    description: [''],
    category: [''],
    isDefault: [false],
  });

  onSubmit() {
    if (this.templateForm.valid) {
      const formValue = this.templateForm.value;
      const template: BudgetTemplateCreate = {
        name: formValue.name!,
        description: formValue.description ?? undefined,
        // category: formValue.category ?? undefined, // Removed: category field doesn't exist in schema
        isDefault: formValue.isDefault ?? false,
      };
      this.addTemplate.emit(template);
      this.templateForm.reset();
    }
  }
}
