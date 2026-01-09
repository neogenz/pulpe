import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import {
  type BudgetLineCreate,
  type TransactionKind,
  type TransactionRecurrence,
} from 'pulpe-shared';
import {
  TransactionIconPipe,
  TransactionLabelPipe,
} from '@ui/transaction-display';

export interface BudgetLineDialogData {
  budgetId: string;
}

@Component({
  selector: 'pulpe-budget-line-dialog',
  imports: [
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    ReactiveFormsModule,
    TransactionIconPipe,
    TransactionLabelPipe,
  ],
  template: `
    <h2 mat-dialog-title class="text-headline-small">Nouvelle prévision</h2>

    <mat-dialog-content>
      <div class="flex flex-col gap-4 pt-4">
        <form [formGroup]="form">
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Nom</mat-label>
            <input
              matInput
              formControlName="name"
              placeholder="Ex: Salaire, Loyer, Épargne..."
              data-testid="new-line-name"
            />
          </mat-form-field>

          <mat-form-field appearance="outline" class="w-full">
            <mat-label class="ph-no-capture">Montant</mat-label>
            <input
              matInput
              type="number"
              formControlName="amount"
              placeholder="0.00"
              step="0.01"
              min="0"
              data-testid="new-line-amount"
            />
            <span matTextSuffix>CHF</span>
          </mat-form-field>

          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Type</mat-label>
            <mat-select formControlName="kind" data-testid="new-line-kind">
              <mat-option value="income">
                <mat-icon class="text-financial-income">{{
                  'income' | transactionIcon
                }}</mat-icon>
                <span>{{ 'income' | transactionLabel }}</span>
              </mat-option>
              <mat-option value="expense">
                <mat-icon class="text-financial-negative">{{
                  'expense' | transactionIcon
                }}</mat-icon>
                <span>{{ 'expense' | transactionLabel }}</span>
              </mat-option>
              <mat-option value="saving">
                <mat-icon class="text-primary">{{
                  'saving' | transactionIcon
                }}</mat-icon>
                <span>{{ 'saving' | transactionLabel }}</span>
              </mat-option>
            </mat-select>
          </mat-form-field>
        </form>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton (click)="handleCancel()" data-testid="cancel-new-line">
        Annuler
      </button>
      <button
        matButton="filled"
        color="primary"
        (click)="handleSubmit()"
        [disabled]="!form.valid"
        data-testid="add-new-line"
      >
        <mat-icon>add</mat-icon>
        Ajouter
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddBudgetLineDialog {
  #dialogRef = inject(MatDialogRef<AddBudgetLineDialog>);
  #data = inject<BudgetLineDialogData>(MAT_DIALOG_DATA);
  #fb = inject(FormBuilder);

  form = this.#fb.group({
    name: ['', [Validators.required, Validators.minLength(1)]],
    amount: [
      null as number | null,
      [Validators.required, Validators.min(0.01)],
    ],
    kind: ['expense' as TransactionKind, Validators.required],
    recurrence: ['one_off' as TransactionRecurrence],
  });

  handleSubmit(): void {
    if (this.form.valid) {
      const value = this.form.getRawValue();
      const budgetLine: BudgetLineCreate = {
        budgetId: this.#data.budgetId,
        name: value.name!.trim(),
        amount: value.amount!,
        kind: value.kind!,
        recurrence: value.recurrence!,
        isManuallyAdjusted: true,
      };
      this.#dialogRef.close(budgetLine);
    }
  }

  handleCancel(): void {
    this.#dialogRef.close();
  }
}
