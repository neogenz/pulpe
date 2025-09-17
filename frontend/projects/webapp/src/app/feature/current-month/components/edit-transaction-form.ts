import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
  type OnInit,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  type AbstractControl,
  type ValidationErrors,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { type Transaction, type TransactionCreate } from '@pulpe/shared';
import { startOfMonth, endOfMonth } from 'date-fns';
import { TransactionValidators } from '../utils/transaction-form-validators';
import { TransactionLabelPipe } from '@ui/transaction-display';

type EditTransactionFormData = Pick<
  TransactionCreate,
  'name' | 'amount' | 'kind' | 'category'
> & {
  transactionDate: string;
};

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
    TransactionLabelPipe,
  ],

  template: `
    <form
      [formGroup]="transactionForm"
      (ngSubmit)="onSubmit()"
      class="flex flex-col gap-6 min-w-0 px-1"
      novalidate
      aria-label="Formulaire de modification de transaction"
    >
      <!-- Transaction Name Field -->
      <mat-form-field subscriptSizing="dynamic" class="w-full">
        <mat-label>Nom de la transaction</mat-label>
        <input
          matInput
          formControlName="name"
          placeholder="Ex: Courses, Loyer, Salaire"
          aria-describedby="name-hint"
          maxlength="100"
        />
        <mat-hint id="name-hint" align="end"
          >{{ transactionForm.get('name')?.value?.length || 0 }}/100</mat-hint
        >
        @if (
          transactionForm.get('name')?.hasError('required') &&
          transactionForm.get('name')?.touched
        ) {
          <mat-error role="alert" aria-live="assertive"
            >Le nom est requis</mat-error
          >
        }
        @if (
          transactionForm.get('name')?.hasError('minlength') &&
          transactionForm.get('name')?.touched
        ) {
          <mat-error role="alert" aria-live="assertive"
            >Le nom doit contenir au moins 2 caractères</mat-error
          >
        }
        @if (
          transactionForm.get('name')?.hasError('maxlength') &&
          transactionForm.get('name')?.touched
        ) {
          <mat-error role="alert" aria-live="assertive"
            >Le nom ne peut pas dépasser 100 caractères</mat-error
          >
        }
      </mat-form-field>

      <!-- Amount Field -->
      <mat-form-field class="w-full" subscriptSizing="dynamic">
        <mat-label class="ph-no-capture">Montant</mat-label>
        <mat-icon matIconPrefix class="text-on-surface-variant"
          >payments</mat-icon
        >
        <input
          matInput
          type="number"
          formControlName="amount"
          placeholder="0.00"
          step="0.01"
          min="0.01"
          max="999999.99"
          aria-describedby="amount-hint"
        />
        <span matTextSuffix>CHF</span>
        <mat-hint id="amount-hint" class="ph-no-capture"
          >Montant en francs suisses</mat-hint
        >
        @if (
          transactionForm.get('amount')?.hasError('required') &&
          transactionForm.get('amount')?.touched
        ) {
          <mat-error role="alert" aria-live="assertive"
            >Le montant est requis</mat-error
          >
        }
        @if (
          transactionForm.get('amount')?.hasError('min') &&
          transactionForm.get('amount')?.touched
        ) {
          <mat-error role="alert" aria-live="assertive"
            >Le montant doit être au moins 0.01 CHF</mat-error
          >
        }
        @if (
          transactionForm.get('amount')?.hasError('max') &&
          transactionForm.get('amount')?.touched
        ) {
          <mat-error role="alert" aria-live="assertive"
            >Le montant ne peut pas dépasser 999'999.99 CHF</mat-error
          >
        }
      </mat-form-field>

      <!-- Type Field -->
      <mat-form-field class="w-full" subscriptSizing="dynamic">
        <mat-label>Type de transaction</mat-label>
        <mat-select formControlName="kind" aria-label="Type de transaction">
          <mat-option value="expense">
            <mat-icon class="mr-2 icon-filled">remove_circle</mat-icon>
            {{ 'expense' | transactionLabel }}
          </mat-option>
          <mat-option value="income">
            <mat-icon class="mr-2 icon-filled">add_circle</mat-icon>
            {{ 'income' | transactionLabel }}
          </mat-option>
          <mat-option value="saving">
            <mat-icon class="mr-2 icon-filled">savings</mat-icon>
            {{ 'saving' | transactionLabel }}
          </mat-option>
        </mat-select>
      </mat-form-field>

      <!-- Date Field -->
      <mat-form-field class="w-full" subscriptSizing="dynamic">
        <mat-label>Date de transaction</mat-label>
        <input
          matInput
          [matDatepicker]="picker"
          [min]="minDate"
          [max]="maxDate"
          formControlName="transactionDate"
          placeholder="jj.mm.aaaa"
          aria-describedby="date-hint"
          readonly
        />
        <mat-datepicker-toggle
          matIconSuffix
          [for]="picker"
          aria-label="Ouvrir le calendrier"
        ></mat-datepicker-toggle>
        <mat-datepicker #picker></mat-datepicker>
        <mat-hint id="date-hint">Doit être dans le mois en cours</mat-hint>
        @if (
          transactionForm.get('transactionDate')?.hasError('required') &&
          transactionForm.get('transactionDate')?.touched
        ) {
          <mat-error role="alert" aria-live="assertive"
            >La date est requise</mat-error
          >
        }
        @if (
          transactionForm.get('transactionDate')?.hasError('dateOutOfRange') &&
          transactionForm.get('transactionDate')?.touched
        ) {
          <mat-error role="alert" aria-live="assertive">
            La date doit être comprise entre le
            {{
              transactionForm.get('transactionDate')?.errors?.['dateOutOfRange']
                ?.min
            }}
            et le
            {{
              transactionForm.get('transactionDate')?.errors?.['dateOutOfRange']
                ?.max
            }}
          </mat-error>
        }
      </mat-form-field>

      <!-- Category Field -->
      <mat-form-field class="w-full" subscriptSizing="dynamic">
        <mat-label>Notes</mat-label>
        <input
          matInput
          formControlName="category"
          placeholder="Ex: Alimentation, Transport"
          maxlength="50"
          aria-describedby="category-hint"
        />
        <mat-hint id="category-hint" align="end"
          >{{ transactionForm.get('category')?.value?.length || 0 }}/50
          (optionnel)</mat-hint
        >
        @if (
          transactionForm.get('category')?.hasError('maxlength') &&
          transactionForm.get('category')?.touched
        ) {
          <mat-error role="alert" aria-live="assertive"
            >La catégorie ne peut pas dépasser 50 caractères</mat-error
          >
        }
      </mat-form-field>
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
  readonly #fb = inject(FormBuilder);

  readonly transaction = input.required<Transaction>();
  readonly updateTransaction = output<EditTransactionFormData>();
  readonly cancelEdit = output<void>();
  readonly isUpdating = signal(false);

  // Date constraints for current month
  protected readonly minDate = startOfMonth(new Date());
  protected readonly maxDate = endOfMonth(new Date());

  // Custom validator for date range
  readonly #dateRangeValidator = (
    control: AbstractControl,
  ): ValidationErrors | null => {
    if (!control.value) return null;

    const date = new Date(control.value);
    const min = this.minDate;
    const max = this.maxDate;

    if (date < min || date > max) {
      return {
        dateOutOfRange: {
          min: min.toLocaleDateString('fr-CH'),
          max: max.toLocaleDateString('fr-CH'),
        },
      };
    }

    return null;
  };

  transactionForm = this.#fb.group({
    name: ['', TransactionValidators.name],
    amount: [null as number | null, TransactionValidators.amount],
    kind: [
      'expense' as 'expense' | 'income' | 'saving',
      TransactionValidators.kind,
    ],
    transactionDate: [
      null as Date | null,
      [Validators.required, this.#dateRangeValidator],
    ],
    category: ['', TransactionValidators.category],
  });

  ngOnInit(): void {
    this.#initializeForm();
  }

  #initializeForm(): void {
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
    } catch (error) {
      if (typeof ngDevMode !== 'undefined' && ngDevMode) {
        console.warn(
          "Impossible d'initialiser le formulaire de transaction :",
          error,
        );
      }
      this.cancelEdit.emit();
    }
  }

  onSubmit(): void {
    if (!this.transactionForm.valid || this.isUpdating()) {
      this.transactionForm.markAllAsTouched();
      return;
    }

    const { name, amount, kind, transactionDate, category } =
      this.transactionForm.getRawValue();
    this.isUpdating.set(true);

    this.updateTransaction.emit({
      name: name as string,
      amount: amount as number,
      kind: kind as 'expense' | 'income' | 'saving',
      transactionDate: (transactionDate as Date).toISOString(),
      category: (category as string) || null,
    });
  }
}
