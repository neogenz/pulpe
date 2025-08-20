import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  type OnInit,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { type Transaction } from '@pulpe/shared';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

export interface EditTransactionFormData {
  name: string;
  amount: number | null;
  kind: 'expense' | 'income' | 'saving';
  transactionDate: string;
  category: string | null;
}

/**
 * Custom validator to ensure date is within current month
 */
function currentMonthValidator() {
  return (control: { value: unknown }) => {
    if (!control.value) return null;

    const selectedDate = new Date(control.value as string);
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    if (!isWithinInterval(selectedDate, { start: monthStart, end: monthEnd })) {
      return { notCurrentMonth: true };
    }

    return null;
  };
}

@Component({
  selector: 'pulpe-edit-transaction-form',
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    ReactiveFormsModule,
  ],
  template: `
    <form
      [formGroup]="transactionForm"
      (ngSubmit)="onSubmit()"
      class="flex flex-col gap-4 min-w-0"
    >
      <mat-form-field subscriptSizing="dynamic">
        <mat-label>Nom</mat-label>
        <input matInput formControlName="name" placeholder="Entrez un nom" />
        @if (
          transactionForm.get('name')?.hasError('required') &&
          transactionForm.get('name')?.touched
        ) {
          <mat-error>Le nom est requis</mat-error>
        }
      </mat-form-field>

      <div class="flex gap-4">
        <mat-form-field class="flex-1" subscriptSizing="dynamic">
          <mat-label>Montant</mat-label>
          <input
            matInput
            type="number"
            formControlName="amount"
            placeholder="0.00"
            step="0.01"
            min="0"
          />
          <span matTextSuffix>CHF</span>
          @if (
            transactionForm.get('amount')?.hasError('required') &&
            transactionForm.get('amount')?.touched
          ) {
            <mat-error>Le montant est requis</mat-error>
          }
          @if (
            transactionForm.get('amount')?.hasError('min') &&
            transactionForm.get('amount')?.touched
          ) {
            <mat-error>Le montant doit être positif</mat-error>
          }
        </mat-form-field>

        <mat-form-field class="flex-1" subscriptSizing="dynamic">
          <mat-label>Type</mat-label>
          <mat-select formControlName="kind">
            <mat-option value="expense">Dépense</mat-option>
            <mat-option value="income">Revenu</mat-option>
            <mat-option value="saving">Épargne</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      <div class="flex gap-4">
        <mat-form-field class="flex-1" subscriptSizing="dynamic">
          <mat-label>Date</mat-label>
          <input
            matInput
            [matDatepicker]="picker"
            formControlName="transactionDate"
          />
          <mat-hint>Date doit être dans le mois actuel</mat-hint>
          <mat-datepicker-toggle
            matIconSuffix
            [for]="picker"
          ></mat-datepicker-toggle>
          <mat-datepicker #picker></mat-datepicker>
          @if (
            transactionForm
              .get('transactionDate')
              ?.hasError('notCurrentMonth') &&
            transactionForm.get('transactionDate')?.touched
          ) {
            <mat-error>La date doit être dans le mois actuel</mat-error>
          }
        </mat-form-field>

        <mat-form-field class="flex-1" subscriptSizing="dynamic">
          <mat-label>Catégorie</mat-label>
          <input matInput formControlName="category" placeholder="Optionnel" />
        </mat-form-field>
      </div>

      <div class="flex gap-3 justify-end">
        <button matButton="outlined" type="button" (click)="cancelEdit.emit()">
          Annuler
        </button>
        <button
          matButton="filled"
          type="submit"
          [disabled]="transactionForm.invalid"
        >
          <mat-icon>save</mat-icon>
          Enregistrer
        </button>
      </div>
    </form>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditTransactionForm implements OnInit {
  #fb = inject(FormBuilder);

  readonly transaction = input.required<Transaction>();
  readonly updateTransaction = output<EditTransactionFormData>();
  readonly cancelEdit = output<void>();

  transactionForm = this.#fb.group({
    name: ['', Validators.required],
    amount: [
      null as number | null,
      [Validators.required, Validators.min(0.01)],
    ],
    kind: ['expense' as 'expense' | 'income' | 'saving', Validators.required],
    transactionDate: ['', [Validators.required, currentMonthValidator()]],
    category: [''],
  });

  ngOnInit(): void {
    const transaction = this.transaction();

    // Parse the date to get just the date part without time
    const transactionDate = new Date(transaction.transactionDate);
    const formattedDate = format(transactionDate, 'yyyy-MM-dd');

    this.transactionForm.patchValue({
      name: transaction.name,
      amount: transaction.amount,
      kind: transaction.kind,
      transactionDate: formattedDate,
      category: transaction.category || '',
    });
  }

  protected onSubmit(): void {
    if (this.transactionForm.valid) {
      const formData = this.transactionForm.getRawValue();

      // Since form is valid, required fields are guaranteed to be non-null
      if (
        !formData.name ||
        !formData.transactionDate ||
        !formData.amount ||
        !formData.kind
      ) {
        console.error('Form validation failed: required fields are missing');
        return;
      }

      // Convert date to ISO string for backend
      const transactionDate = new Date(formData.transactionDate);
      const isoDate = transactionDate.toISOString();

      this.updateTransaction.emit({
        name: formData.name,
        amount: formData.amount,
        kind: formData.kind,
        transactionDate: isoDate,
        category: formData.category || null,
      });
    }
  }
}
