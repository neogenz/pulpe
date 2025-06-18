import {
  ChangeDetectionStrategy,
  Component,
  inject,
  output,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

export interface TransactionFormData {
  name: string;
  amount: number | null;
  type: 'expense' | 'income' | 'saving';
}

@Component({
  selector: 'pulpe-quick-add-expense-form',
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    ReactiveFormsModule,
  ],
  template: `
    <form
      [formGroup]="transactionForm"
      (ngSubmit)="addTransaction.emit(transactionForm.getRawValue())"
      class="flex flex-col md:flex-row md:items-baseline gap-4"
    >
      <mat-form-field class="flex-1" subscriptSizing="dynamic">
        <mat-label>Nom</mat-label>
        <input matInput formControlName="name" placeholder="Entrez un nom" />
      </mat-form-field>

      <mat-form-field class="flex-1" subscriptSizing="dynamic">
        <mat-label>Montant</mat-label>
        <input
          matInput
          type="number"
          formControlName="amount"
          placeholder="0.00"
        />
        <span matTextSuffix>CHF</span>
      </mat-form-field>

      <mat-form-field class="flex-1" subscriptSizing="dynamic">
        <mat-label>Type</mat-label>
        <mat-select formControlName="type">
          <mat-option value="expense">Dépense</mat-option>
          <mat-option value="income">Revenu</mat-option>
          <mat-option value="saving">Épargne</mat-option>
        </mat-select>
      </mat-form-field>

      <button
        matButton="filled"
        type="submit"
        [disabled]="transactionForm.invalid"
        class="w-full sm:w-auto"
      >
        <mat-icon>add_circle</mat-icon>
        Ajouter
      </button>
    </form>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuickAddExpenseForm {
  #fb = inject(FormBuilder);
  addTransaction = output<TransactionFormData>();

  transactionForm = this.#fb.nonNullable.group({
    name: ['', Validators.required],
    amount: [null, [Validators.required, Validators.min(0)]],
    type: ['expense' as const, Validators.required],
  });
}
