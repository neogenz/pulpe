import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { type BudgetLine, type Transaction } from '@pulpe/shared';
import { firstValueFrom } from 'rxjs';
import { TransactionApi } from '@core/transaction';
import { format } from 'date-fns';

export interface AllocatedTransactionFormDialogData {
  budgetLine: BudgetLine;
  transaction?: Transaction;
  mode: 'create' | 'edit';
}

export interface AllocatedTransactionFormDialogResult {
  created?: boolean;
  updated?: boolean;
  deleted?: boolean;
}

@Component({
  selector: 'pulpe-allocated-transaction-form-dialog',
  standalone: true,
  providers: [
    {
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: { appearance: 'outline' },
    },
  ],
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title class="text-headline-small">
      {{
        data.mode === 'create'
          ? 'Nouvelle transaction'
          : 'Modifier la transaction'
      }}
    </h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="flex flex-col gap-4 pt-4">
        <!-- Amount Field (first for quick entry) -->
        <mat-form-field>
          <mat-label>Montant</mat-label>
          <input
            matInput
            type="number"
            inputmode="decimal"
            formControlName="amount"
            placeholder="0.00"
            min="0.01"
            step="0.01"
            class="text-right"
          />
          <span matTextSuffix>CHF</span>
          @if (form.controls.amount.hasError('required')) {
            <mat-error>Le montant est requis</mat-error>
          }
          @if (form.controls.amount.hasError('min')) {
            <mat-error>Le montant doit être positif</mat-error>
          }
        </mat-form-field>

        <mat-form-field>
          <mat-label>Nom</mat-label>
          <input
            matInput
            formControlName="name"
            placeholder="Ex: Courses supermarché"
          />
          @if (form.controls.name.hasError('required')) {
            <mat-error>Le nom est requis</mat-error>
          }
        </mat-form-field>

        <mat-form-field>
          <mat-label>Date</mat-label>
          <input matInput type="date" formControlName="transactionDate" />
          @if (form.controls.transactionDate.hasError('required')) {
            <mat-error>La date est requise</mat-error>
          }
        </mat-form-field>

        <mat-form-field>
          <mat-label>Catégorie (optionnel)</mat-label>
          <input
            matInput
            formControlName="category"
            placeholder="Ex: Alimentation"
            maxlength="50"
          />
          <mat-hint align="end">
            {{ form.controls.category.value.length || 0 }}/50
          </mat-hint>
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="gap-2">
      <button
        matButton="outlined"
        type="button"
        (click)="cancel()"
        [disabled]="isProcessing()"
      >
        Annuler
      </button>
      <button
        matButton="filled"
        type="button"
        (click)="submit()"
        [disabled]="form.invalid || isProcessing()"
      >
        @if (isProcessing()) {
          <mat-spinner diameter="20" />
        } @else if (data.mode === 'create') {
          <mat-icon aria-hidden="true">add</mat-icon>
          Ajouter
        } @else {
          <mat-icon aria-hidden="true">save</mat-icon>
          Enregistrer
        }
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AllocatedTransactionFormDialog {
  readonly #fb = inject(FormBuilder);
  readonly #dialogRef = inject(
    MatDialogRef<
      AllocatedTransactionFormDialog,
      AllocatedTransactionFormDialogResult
    >,
  );
  readonly #transactionApi = inject(TransactionApi);

  protected readonly data =
    inject<AllocatedTransactionFormDialogData>(MAT_DIALOG_DATA);

  protected readonly isProcessing = signal(false);

  protected readonly form = this.#fb.nonNullable.group({
    name: [this.data.transaction?.name ?? '', Validators.required],
    amount: [
      this.data.transaction?.amount ?? 0,
      [Validators.required, Validators.min(0.01)],
    ],
    transactionDate: [
      this.data.transaction?.transactionDate
        ? format(new Date(this.data.transaction.transactionDate), 'yyyy-MM-dd')
        : format(new Date(), 'yyyy-MM-dd'),
      Validators.required,
    ],
    category: [this.data.transaction?.category ?? ''],
  });

  protected cancel(): void {
    this.#dialogRef.close();
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.isProcessing()) return;

    this.isProcessing.set(true);

    try {
      const formValue = this.form.getRawValue();

      if (this.data.mode === 'create') {
        await firstValueFrom(
          this.#transactionApi.create$({
            budgetId: this.data.budgetLine.budgetId,
            budgetLineId: this.data.budgetLine.id,
            name: formValue.name,
            amount: formValue.amount,
            kind: this.data.budgetLine.kind,
            transactionDate: new Date(formValue.transactionDate).toISOString(),
            category: formValue.category || null,
          }),
        );
        this.#dialogRef.close({ created: true });
      } else if (this.data.transaction) {
        await firstValueFrom(
          this.#transactionApi.update$(this.data.transaction.id, {
            name: formValue.name,
            amount: formValue.amount,
            transactionDate: new Date(formValue.transactionDate).toISOString(),
            category: formValue.category || null,
          }),
        );
        this.#dialogRef.close({ updated: true });
      }
    } catch (error) {
      console.error('Error saving transaction:', error);
      // TODO: Show error toast
    } finally {
      this.isProcessing.set(false);
    }
  }
}
