import {
  type AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import type { TransactionCreate } from '@pulpe/shared';

type TransactionFormData = Pick<
  TransactionCreate,
  'name' | 'amount' | 'kind' | 'category'
>;
import { TransactionValidators } from '../utils/transaction-form-validators';

@Component({
  selector: 'pulpe-add-transaction-bottom-sheet',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
  ],
  template: `
    <div class="flex flex-col gap-4">
      <!-- Drag indicator -->
      <div
        class="w-9 h-1 bg-outline-variant rounded-sm mx-auto mt-3 mb-2"
      ></div>

      <!-- Header -->
      <div class="flex justify-between items-center">
        <h2 class="text-title-large text-on-surface m-0">
          Nouvelle transaction
        </h2>
        <button matIconButton (click)="close()" aria-label="Fermer">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Form -->
      <form
        [formGroup]="transactionForm"
        (ngSubmit)="onSubmit()"
        class="flex flex-col gap-4"
        novalidate
      >
        <!-- Amount Field -->
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Montant</mat-label>
          <input
            class="!text-xl !font-bold !text-center"
            matInput
            #amountInput
            type="number"
            inputmode="decimal"
            placeholder="0.00"
            formControlName="amount"
            data-testid="transaction-amount-input"
            step="0.01"
            min="0.01"
            max="999999.99"
            required
          />
          <span matTextSuffix>CHF</span>
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
        </mat-form-field>

        <!-- Predefined Amounts -->
        <div class="flex flex-col gap-3">
          <div class="text-sm font-medium text-on-surface-variant">
            Montants rapides
          </div>
          <div class="flex flex-wrap gap-2">
            @for (amount of predefinedAmounts(); track amount) {
              <button
                matButton="tonal"
                type="button"
                (click)="selectPredefinedAmount(amount)"
                class="!min-w-[80px] !h-[40px]"
              >
                {{ amount }} CHF
              </button>
            }
          </div>
        </div>

        <!-- Name Field -->
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Description</mat-label>
          <input
            matInput
            formControlName="name"
            data-testid="transaction-description-input"
            placeholder="Ex: Courses chez Migros"
          />
          @if (
            transactionForm.get('name')?.hasError('required') &&
            transactionForm.get('name')?.touched
          ) {
            <mat-error role="alert" aria-live="assertive"
              >La description est requise</mat-error
            >
          }
          @if (
            transactionForm.get('name')?.hasError('minlength') &&
            transactionForm.get('name')?.touched
          ) {
            <mat-error role="alert" aria-live="assertive"
              >La description doit contenir au moins 2 caractères</mat-error
            >
          }
        </mat-form-field>

        <!-- Type Field -->
        <mat-form-field class="w-full" subscriptSizing="dynamic">
          <mat-label>Type de transaction</mat-label>
          <mat-select
            formControlName="kind"
            aria-label="Type de transaction"
            data-testid="transaction-type-select"
          >
            <mat-option value="expense">
              <mat-icon class="mr-2 icon-filled">remove_circle</mat-icon>
              Dépense
            </mat-option>
            <mat-option value="income">
              <mat-icon class="mr-2 icon-filled">add_circle</mat-icon>
              Revenu
            </mat-option>
            <mat-option value="saving">
              <mat-icon class="mr-2 icon-filled">savings</mat-icon>
              Épargne
            </mat-option>
          </mat-select>
        </mat-form-field>

        <!-- Category/Notes Field -->
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
              >Les notes ne peuvent pas dépasser 50 caractères</mat-error
            >
          }
        </mat-form-field>

        <!-- Date display (today by default) -->
        <div
          class="flex items-center gap-2 p-3 bg-surface-container rounded-lg text-on-surface-variant"
        >
          <mat-icon>event</mat-icon>
          <span>Aujourd'hui</span>
        </div>
      </form>

      <!-- Action Buttons -->
      <div class="flex gap-3 pt-4 pb-6 px-6 border-t border-outline-variant">
        <button matButton (click)="close()" class="flex-1">Annuler</button>
        <button
          matButton="outlined"
          (click)="onSubmit()"
          [disabled]="transactionForm.invalid"
          data-testid="transaction-submit-button"
          class="flex-2"
        >
          Ajouter
        </button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTransactionBottomSheet implements AfterViewInit {
  readonly #fb = inject(FormBuilder);
  readonly #bottomSheetRef = inject(
    MatBottomSheetRef<AddTransactionBottomSheet>,
  );

  // View child for focus management
  protected readonly amountInput =
    viewChild<ElementRef<HTMLInputElement>>('amountInput');

  // Predefined amounts for quick selection
  protected readonly predefinedAmounts = signal([10, 15, 20, 30]);

  // Reactive form with shared validators for consistency
  readonly transactionForm = this.#fb.group({
    name: ['Dépense', TransactionValidators.name],
    amount: [null, TransactionValidators.amount],
    kind: [
      'expense' as 'expense' | 'income' | 'saving',
      TransactionValidators.kind,
    ],
    category: ['', TransactionValidators.category],
  });

  ngAfterViewInit(): void {
    // Auto-focus on amount field for immediate input
    setTimeout(() => {
      this.amountInput()?.nativeElement?.focus();
    }, 200);
  }

  protected selectPredefinedAmount(amount: number): void {
    this.transactionForm.patchValue({ amount });
  }

  protected onSubmit(): void {
    if (!this.transactionForm.valid) {
      this.transactionForm.markAllAsTouched();
      return;
    }

    const formValue = this.transactionForm.value;

    const transaction: TransactionFormData = {
      name: formValue.name as string,
      amount: formValue.amount as number,
      kind: formValue.kind as 'expense' | 'income' | 'saving',
      category: (formValue.category as string) || null,
    };

    this.#bottomSheetRef.dismiss(transaction);
  }

  protected close(): void {
    this.#bottomSheetRef.dismiss();
  }
}
