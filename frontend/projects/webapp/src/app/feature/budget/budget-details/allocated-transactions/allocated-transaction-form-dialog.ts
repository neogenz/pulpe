import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import type {
  Transaction,
  TransactionCreate,
  TransactionKind,
  TransactionUpdate,
} from '@pulpe/shared';

export interface AllocatedTransactionFormDialogData {
  budgetLineId: string;
  budgetId: string;
  kind: TransactionKind;
  transaction?: Transaction;
}

export type AllocatedTransactionFormResult =
  | {
      mode: 'create';
      data: TransactionCreate;
    }
  | {
      mode: 'update';
      transactionId: string;
      originalAmount: number;
      data: TransactionUpdate;
    };

@Component({
  selector: 'pulpe-allocated-transaction-form-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title data-testid="dialog-title">
      {{ isEditMode() ? 'Modifier la transaction' : 'Ajouter une transaction' }}
    </h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="form-container">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Description</mat-label>
          <input
            matInput
            formControlName="name"
            placeholder="Ex: Plein essence"
            data-testid="name-input"
          />
          @if (form.get('name')?.errors?.['required']) {
            <mat-error>La description est requise</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Montant (CHF)</mat-label>
          <input
            matInput
            type="number"
            formControlName="amount"
            placeholder="0"
            data-testid="amount-input"
          />
          @if (form.get('amount')?.errors?.['required']) {
            <mat-error>Le montant est requis</mat-error>
          }
          @if (form.get('amount')?.errors?.['min']) {
            <mat-error>Le montant doit être supérieur à 0</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Date</mat-label>
          <input
            matInput
            type="date"
            formControlName="transactionDate"
            data-testid="date-input"
          />
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button data-testid="cancel-button" (click)="cancel()">
        Annuler
      </button>
      <button
        mat-flat-button
        color="primary"
        data-testid="submit-button"
        [disabled]="form.invalid"
        (click)="submit()"
      >
        {{ isEditMode() ? 'Enregistrer' : 'Ajouter' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .form-container {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      min-width: 300px;
    }

    .full-width {
      width: 100%;
    }
  `,
})
export class AllocatedTransactionFormDialog {
  readonly #dialogRef = inject(
    MatDialogRef<
      AllocatedTransactionFormDialog,
      AllocatedTransactionFormResult
    >,
  );
  readonly #fb = inject(FormBuilder);
  readonly data = inject<AllocatedTransactionFormDialogData>(MAT_DIALOG_DATA);

  readonly isEditMode = computed(() => !!this.data.transaction);

  readonly form = this.#fb.nonNullable.group({
    name: [this.data.transaction?.name ?? '', Validators.required],
    amount: [
      this.data.transaction?.amount ?? (null as number | null),
      [Validators.required, Validators.min(0.01)],
    ],
    transactionDate: [this.#getInitialDate(), Validators.required],
  });

  #getInitialDate(): string {
    if (this.data.transaction?.transactionDate) {
      // Extract date part from ISO string (e.g., "2024-12-15T00:00:00.000Z" -> "2024-12-15")
      return this.data.transaction.transactionDate.split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
  }

  submit(): void {
    if (this.form.invalid) return;

    const formValue = this.form.getRawValue();
    const transactionDate = `${formValue.transactionDate}T00:00:00.000Z`;

    if (this.isEditMode() && this.data.transaction) {
      const result: AllocatedTransactionFormResult = {
        mode: 'update',
        transactionId: this.data.transaction.id,
        originalAmount: this.data.transaction.amount,
        data: {
          name: formValue.name,
          amount: formValue.amount!,
          transactionDate,
        },
      };
      this.#dialogRef.close(result);
    } else {
      const result: AllocatedTransactionFormResult = {
        mode: 'create',
        data: {
          budgetId: this.data.budgetId,
          budgetLineId: this.data.budgetLineId,
          kind: this.data.kind,
          name: formValue.name,
          amount: formValue.amount!,
          transactionDate,
        },
      };
      this.#dialogRef.close(result);
    }
  }

  cancel(): void {
    this.#dialogRef.close();
  }
}
