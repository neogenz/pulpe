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
  type BudgetLine,
  type BudgetLineUpdate,
  type TransactionKind,
  type TransactionRecurrence,
} from 'pulpe-shared';
import {
  TransactionIconPipe,
  TransactionLabelPipe,
} from '@ui/transaction-display';

export interface EditBudgetLineDialogData {
  budgetLine: BudgetLine;
}

@Component({
  selector: 'pulpe-edit-budget-line-dialog',
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
    <h2 mat-dialog-title class="text-headline-small">Modifier la prévision</h2>

    <mat-dialog-content>
      <div class="flex flex-col gap-4 pt-4">
        <form [formGroup]="form">
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Nom</mat-label>
            <input
              matInput
              formControlName="name"
              placeholder="Ex: Salaire, Loyer, Épargne..."
              data-testid="edit-line-name"
            />
            @if (
              form.get('name')?.hasError('required') &&
              form.get('name')?.touched
            ) {
              <mat-error>Le nom est requis</mat-error>
            }
            @if (
              form.get('name')?.hasError('minlength') &&
              form.get('name')?.touched
            ) {
              <mat-error>Le nom doit contenir au moins 1 caractère</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Montant</mat-label>
            <input
              matInput
              type="number"
              formControlName="amount"
              placeholder="0"
              step="1"
              min="0"
              data-testid="edit-line-amount"
            />
            <span matTextSuffix>CHF</span>
            @if (
              form.get('amount')?.hasError('required') &&
              form.get('amount')?.touched
            ) {
              <mat-error>Le montant est requis</mat-error>
            }
            @if (
              form.get('amount')?.hasError('min') && form.get('amount')?.touched
            ) {
              <mat-error>Le montant doit être supérieur à 0</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Type</mat-label>
            <mat-select formControlName="kind" data-testid="edit-line-kind">
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
            @if (
              form.get('kind')?.hasError('required') &&
              form.get('kind')?.touched
            ) {
              <mat-error>Le type est requis</mat-error>
            }
          </mat-form-field>
        </form>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton (click)="handleCancel()" data-testid="cancel-edit-line">
        Annuler
      </button>
      <button
        matButton="filled"
        color="primary"
        (click)="handleSubmit()"
        [disabled]="!form.valid"
        data-testid="save-edit-line"
      >
        <mat-icon>save</mat-icon>
        Enregistrer
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditBudgetLineDialog {
  #dialogRef = inject(MatDialogRef<EditBudgetLineDialog>);
  #data = inject<EditBudgetLineDialogData>(MAT_DIALOG_DATA);
  #fb = inject(FormBuilder);

  form = this.#fb.group({
    name: [
      this.#data.budgetLine.name,
      [Validators.required, Validators.minLength(1)],
    ],
    amount: [
      this.#data.budgetLine.amount,
      [Validators.required, Validators.min(0.01)],
    ],
    kind: [this.#data.budgetLine.kind as TransactionKind, Validators.required],
    recurrence: [
      this.#data.budgetLine.recurrence as TransactionRecurrence,
      Validators.required,
    ],
  });

  handleSubmit(): void {
    if (!this.form.valid) return;
    const value = this.form.value;
    const update: BudgetLineUpdate = {
      id: this.#data.budgetLine.id,
      name: value.name!.trim(),
      amount: value.amount!,
      kind: value.kind!,
      recurrence: value.recurrence!,
      templateLineId: this.#data.budgetLine.templateLineId,
      savingsGoalId: this.#data.budgetLine.savingsGoalId,
      isManuallyAdjusted: true,
    };
    this.#dialogRef.close(update);
  }

  handleCancel(): void {
    this.#dialogRef.close();
  }
}
