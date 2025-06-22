import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
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
    <mat-card>
      <mat-card-header>
        <mat-card-title>Nouveau modèle de budget</mat-card-title>
      </mat-card-header>
      <form [formGroup]="templateForm" (ngSubmit)="onSubmit()">
        <mat-card-content class="space-y-4">
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Nom du modèle</mat-label>
            <input matInput formControlName="name" required>
            @if (templateForm.get('name')?.invalid && templateForm.get('name')?.touched) {
              <mat-error>Le nom est requis</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Description</mat-label>
            <textarea matInput formControlName="description" rows="3"></textarea>
          </mat-form-field>

          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Catégorie</mat-label>
            <input matInput formControlName="category">
          </mat-form-field>

          <mat-checkbox formControlName="isDefault">
            Modèle par défaut
          </mat-checkbox>
        </mat-card-content>

        <mat-card-actions align="end">
          <button
            mat-button
            type="button"
            (click)="cancelForm.emit()"
            [disabled]="isCreating()"
          >
            Annuler
          </button>
          <button
            mat-button="raised"
            color="primary"
            type="submit"
            [disabled]="templateForm.invalid || isCreating()"
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
  changeDetection: ChangeDetectionStrategy.OnPush
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
    isDefault: [false]
  });

  onSubmit() {
    if (this.templateForm.valid) {
      const formValue = this.templateForm.value;
      const template: BudgetTemplateCreate = {
        name: formValue.name!,
        description: formValue.description || null,
        category: formValue.category || null,
        isDefault: formValue.isDefault || false
      };
      this.addTemplate.emit(template);
      this.templateForm.reset();
    }
  }
}
