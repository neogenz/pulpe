import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import {
  type BudgetLineCreate,
  type TransactionKind,
  type TransactionRecurrence,
} from '@pulpe/shared';

interface BudgetLineFormData {
  name: string;
  amount: number | null;
  kind: TransactionKind;
  recurrence: TransactionRecurrence;
}

@Component({
  selector: 'pulpe-budget-line-form',
  imports: [
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    FormsModule,
  ],
  template: `
    <mat-card class="bg-[color-surface-container]">
      <mat-card-header>
        <mat-card-title class="text-headline-small">
          Ajouter une ligne de budget
        </mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <div class="flex flex-col gap-4">
          <mat-form-field appearance="fill" class="w-full">
            <mat-label>Nom</mat-label>
            <input
              matInput
              [(ngModel)]="formData.name"
              placeholder="Ex: Salaire, Loyer, Épargne..."
              data-testid="new-line-name"
            />
          </mat-form-field>

          <mat-form-field appearance="fill" class="w-full">
            <mat-label>Montant</mat-label>
            <input
              matInput
              type="number"
              [(ngModel)]="formData.amount"
              placeholder="0.00"
              step="0.01"
              min="0"
              data-testid="new-line-amount"
            />
            <span matTextSuffix>CHF</span>
          </mat-form-field>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <mat-form-field appearance="fill" class="w-full">
              <mat-label>Type</mat-label>
              <mat-select
                [(ngModel)]="formData.kind"
                data-testid="new-line-kind"
              >
                <mat-option value="INCOME">
                  <mat-icon class="text-financial-income">trending_up</mat-icon>
                  <span>Revenu</span>
                </mat-option>
                <mat-option value="FIXED_EXPENSE">
                  <mat-icon class="text-financial-negative"
                    >trending_down</mat-icon
                  >
                  <span>Dépense</span>
                </mat-option>
                <mat-option value="SAVINGS_CONTRIBUTION">
                  <mat-icon class="text-[color-primary]">savings</mat-icon>
                  <span>Épargne</span>
                </mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="fill" class="w-full">
              <mat-label>Récurrence</mat-label>
              <mat-select
                [(ngModel)]="formData.recurrence"
                data-testid="new-line-recurrence"
              >
                <mat-option value="fixed">Fixe</mat-option>
                <mat-option value="variable">Variable</mat-option>
                <mat-option value="one_off">Ponctuel</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </div>
      </mat-card-content>
      <mat-card-actions class="flex justify-end gap-2 px-4 pb-4">
        <button
          mat-stroked-button
          (click)="handleCancel()"
          data-testid="cancel-new-line"
        >
          Annuler
        </button>
        <button
          mat-filled-button
          color="primary"
          (click)="handleSubmit()"
          [disabled]="!isValid()"
          data-testid="add-new-line"
        >
          <mat-icon>add</mat-icon>
          Ajouter
        </button>
      </mat-card-actions>
    </mat-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetLineForm {
  budgetId = input.required<string>();
  submitted = output<BudgetLineCreate>();
  cancelled = output<void>();

  formData: BudgetLineFormData = {
    name: '',
    amount: null,
    kind: 'INCOME',
    recurrence: 'fixed',
  };

  handleSubmit(): void {
    if (this.isValid()) {
      this.submitted.emit({
        budgetId: this.budgetId(),
        name: this.formData.name.trim(),
        amount: this.formData.amount!,
        kind: this.formData.kind,
        recurrence: this.formData.recurrence,
        isManuallyAdjusted: true,
      });
      this.#resetForm();
    }
  }

  handleCancel(): void {
    this.#resetForm();
    this.cancelled.emit();
  }

  isValid(): boolean {
    return (
      this.formData.name.trim().length > 0 &&
      this.formData.amount !== null &&
      this.formData.amount > 0
    );
  }

  #resetForm(): void {
    this.formData = {
      name: '',
      amount: null,
      kind: 'INCOME',
      recurrence: 'fixed',
    };
  }
}
