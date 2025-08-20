import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
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
import { startOfMonth, endOfMonth } from 'date-fns';

export interface EditTransactionFormData {
  name: string;
  amount: number | null;
  kind: 'expense' | 'income' | 'saving';
  transactionDate: string;
  category: string | null;
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
  standalone: true,
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
            [min]="minDate"
            [max]="maxDate"
            formControlName="transactionDate"
          />
          <mat-hint>Date doit être dans le mois actuel</mat-hint>
          <mat-datepicker-toggle
            matIconSuffix
            [for]="picker"
          ></mat-datepicker-toggle>
          <mat-datepicker #picker></mat-datepicker>
          @if (
            transactionForm.get('transactionDate')?.hasError('required') &&
            transactionForm.get('transactionDate')?.touched
          ) {
            <mat-error>La date est requise</mat-error>
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
          [disabled]="transactionForm.invalid || isUpdating()"
        >
          <mat-icon>{{ isUpdating() ? 'hourglass_empty' : 'save' }}</mat-icon>
          {{ isUpdating() ? 'Enregistrement...' : 'Enregistrer' }}
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
  readonly isUpdating = signal(false);

  // Date constraints for current month
  protected readonly minDate = startOfMonth(new Date());
  protected readonly maxDate = endOfMonth(new Date());

  transactionForm = this.#fb.group({
    name: ['', Validators.required],
    amount: [
      null as number | null,
      [Validators.required, Validators.min(0.01)],
    ],
    kind: ['expense' as 'expense' | 'income' | 'saving', Validators.required],
    transactionDate: [null as Date | null, Validators.required],
    category: [''],
  });

  ngOnInit(): void {
    this.initializeForm();
  }

  /**
   * Initialize form with transaction data and reset validation state
   */
  private initializeForm(): void {
    // Reset form state to pristine
    this.transactionForm.markAsUntouched();
    this.transactionForm.markAsPristine();

    // Reset loading state
    this.isUpdating.set(false);

    // Only populate form if transaction input is available
    // This handles both initialization and reset scenarios
    try {
      const transaction = this.transaction();

      // Use Date object directly for Material DatePicker
      const transactionDate = new Date(transaction.transactionDate);

      this.transactionForm.patchValue({
        name: transaction.name,
        amount: transaction.amount,
        kind: transaction.kind,
        transactionDate,
        category: transaction.category || '',
      });
    } catch {
      // Input not available yet (e.g., during testing or initial creation)
      // Form will be populated when ngOnInit is called
    }
  }

  protected onSubmit(): void {
    if (this.transactionForm.valid && !this.isUpdating()) {
      const formData = this.transactionForm.getRawValue();

      // Convert date to ISO string for backend
      const isoDate = (formData.transactionDate as Date).toISOString();

      // Set loading state - will be reset by dialog close or form reset
      this.isUpdating.set(true);

      this.updateTransaction.emit({
        name: formData.name!,
        amount: formData.amount!,
        kind: formData.kind!,
        transactionDate: isoDate,
        category: formData.category || null,
      });
    }
  }
}
