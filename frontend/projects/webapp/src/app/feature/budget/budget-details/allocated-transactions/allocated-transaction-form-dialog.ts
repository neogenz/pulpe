import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  type AbstractControl,
  type ValidationErrors,
} from '@angular/forms';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import {
  type BudgetLine,
  type Transaction,
  type TransactionCreate,
  type TransactionUpdate,
} from '@pulpe/shared';
import { TransactionLabelPipe } from '@ui/transaction-display';
import { endOfMonth, startOfMonth } from 'date-fns';
import { startWith } from 'rxjs';

export interface AllocatedTransactionFormDialogData {
  budgetLine: BudgetLine;
  budgetId: string;
  month: number;
  year: number;
  /** Existing transaction for edit mode, undefined for create mode */
  transaction?: Transaction;
  /** Current consumed amount (excluding transaction being edited) */
  consumedAmount: number;
}

export type AllocatedTransactionFormDialogResult =
  | { action: 'create'; data: TransactionCreate }
  | { action: 'update'; id: string; data: TransactionUpdate }
  | undefined;

@Component({
  selector: 'pulpe-allocated-transaction-form-dialog',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatDatepickerModule,
    ReactiveFormsModule,
    CurrencyPipe,
    DatePipe,
    TransactionLabelPipe,
  ],
  template: `
    <div class="flex flex-col h-full">
      <!-- Drag handle for bottom sheet -->
      @if (isBottomSheet()) {
        <div class="flex justify-center pt-3 pb-2">
          <div class="w-9 h-1 bg-outline-variant rounded-sm"></div>
        </div>
      }

      <!-- Header -->
      <div class="flex items-center justify-between gap-2 px-4 py-3">
        <h2 class="text-title-large text-on-surface m-0">
          {{
            isEditMode() ? 'Modifier la transaction' : 'Nouvelle transaction'
          }}
        </h2>
        <button
          matIconButton
          (click)="onCancel()"
          aria-label="Fermer"
          class="shrink-0"
        >
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Content - scrollable -->
      <div class="flex-1 overflow-y-auto px-4">
        <div class="flex flex-col gap-4">
          <!-- Budget Line Context -->
          <div
            class="rounded-lg p-4 bg-surface-container border border-outline-variant"
          >
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2 min-w-0">
                <mat-icon class="text-on-surface-variant">sell</mat-icon>
                <span class="text-title-medium truncate">{{
                  data.budgetLine.name
                }}</span>
              </div>
              <span class="text-label-medium text-on-surface-variant">
                {{ data.budgetLine.kind | transactionLabel }}
              </span>
            </div>

            <!-- Progress Bar -->
            <div
              class="mb-2 h-2 rounded-full overflow-hidden bg-outline-variant"
            >
              <div
                class="h-full rounded-full transition-all duration-300"
                [class]="isOverBudget() ? 'bg-error' : 'bg-primary'"
                [style.width.%]="progressPercentage()"
              ></div>
            </div>

            <!-- Budget Stats -->
            <div class="flex justify-between text-body-small">
              <span class="text-on-surface-variant">
                {{
                  consumedAmount()
                    | currency: 'CHF' : 'symbol' : '1.2-2' : 'de-CH'
                }}
                consommés
              </span>
              <span
                [class]="
                  isOverBudget()
                    ? 'text-error font-medium'
                    : 'text-on-surface-variant'
                "
              >
                {{
                  remainingAmount()
                    | currency: 'CHF' : 'symbol' : '1.2-2' : 'de-CH'
                }}
                restants
              </span>
            </div>
          </div>

          <!-- Form -->
          <form [formGroup]="form" class="flex flex-col gap-4">
            <!-- Name Field -->
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Description</mat-label>
              <input
                matInput
                formControlName="name"
                placeholder="Ex: Courses Migros, Loyer, Salaire"
                maxlength="100"
                data-testid="transaction-name-input"
              />
              <mat-hint align="end">
                {{ form.get('name')?.value?.length || 0 }}/100
              </mat-hint>
              @if (
                form.get('name')?.hasError('required') &&
                form.get('name')?.touched
              ) {
                <mat-error>La description est requise</mat-error>
              }
              @if (
                form.get('name')?.hasError('minlength') &&
                form.get('name')?.touched
              ) {
                <mat-error>Minimum 2 caractères</mat-error>
              }
            </mat-form-field>

            <!-- Amount Field -->
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Montant</mat-label>
              <mat-icon matIconPrefix class="text-on-surface-variant">
                payments
              </mat-icon>
              <input
                matInput
                type="number"
                formControlName="amount"
                placeholder="0.00"
                step="0.01"
                min="0.01"
                max="999999.99"
                data-testid="transaction-amount-input"
              />
              <span matTextSuffix>CHF</span>
              @if (
                form.get('amount')?.hasError('required') &&
                form.get('amount')?.touched
              ) {
                <mat-error>Le montant est requis</mat-error>
              }
              @if (
                form.get('amount')?.hasError('min') &&
                form.get('amount')?.touched
              ) {
                <mat-error>Minimum 0.01 CHF</mat-error>
              }
              @if (
                form.get('amount')?.hasError('max') &&
                form.get('amount')?.touched
              ) {
                <mat-error>Maximum 999'999.99 CHF</mat-error>
              }
            </mat-form-field>

            <!-- Date Field -->
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Date</mat-label>
              <input
                matInput
                [matDatepicker]="picker"
                [min]="minDate"
                [max]="maxDate"
                formControlName="transactionDate"
                placeholder="jj.mm.aaaa"
                readonly
                data-testid="transaction-date-input"
              />
              <mat-datepicker-toggle
                matIconSuffix
                [for]="picker"
                aria-label="Ouvrir le calendrier"
              />
              <mat-datepicker #picker />
              <mat-hint>
                Du {{ minDate | date: 'dd.MM.yyyy' }} au
                {{ maxDate | date: 'dd.MM.yyyy' }}
              </mat-hint>
              @if (
                form.get('transactionDate')?.hasError('required') &&
                form.get('transactionDate')?.touched
              ) {
                <mat-error>La date est requise</mat-error>
              }
              @if (
                form.get('transactionDate')?.hasError('dateOutOfRange') &&
                form.get('transactionDate')?.touched
              ) {
                <mat-error>La date doit être dans le mois du budget</mat-error>
              }
            </mat-form-field>

            <!-- Category/Notes Field -->
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Notes (optionnel)</mat-label>
              <input
                matInput
                formControlName="category"
                placeholder="Ex: Alimentation, Transport"
                maxlength="50"
                data-testid="transaction-category-input"
              />
              <mat-hint align="end">
                {{ form.get('category')?.value?.length || 0 }}/50
              </mat-hint>
            </mat-form-field>
          </form>
        </div>
      </div>

      <!-- Action buttons - fixed footer -->
      <div
        class="flex gap-3 p-4 border-t border-outline-variant bg-surface justify-end"
      >
        <button matButton (click)="onCancel()" data-testid="cancel-button">
          Annuler
        </button>
        <button
          matButton="filled"
          [disabled]="form.invalid || isSubmitting()"
          (click)="onSubmit()"
          data-testid="submit-button"
        >
          @if (isSubmitting()) {
            <mat-icon class="animate-spin">refresh</mat-icon>
          } @else {
            <mat-icon>{{ isEditMode() ? 'save' : 'add' }}</mat-icon>
          }
          {{ isEditMode() ? 'Enregistrer' : 'Ajouter' }}
        </button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AllocatedTransactionFormDialog {
  readonly #fb = inject(FormBuilder);

  // Dual injection: component can be opened via Dialog or BottomSheet
  readonly #dialogRef = inject(
    MatDialogRef<
      AllocatedTransactionFormDialog,
      AllocatedTransactionFormDialogResult
    >,
    { optional: true },
  );
  readonly #bottomSheetRef = inject(
    MatBottomSheetRef<
      AllocatedTransactionFormDialog,
      AllocatedTransactionFormDialogResult
    >,
    { optional: true },
  );

  // Data can come from Dialog or BottomSheet
  readonly data =
    inject<AllocatedTransactionFormDialogData>(MAT_DIALOG_DATA, {
      optional: true,
    }) ?? inject<AllocatedTransactionFormDialogData>(MAT_BOTTOM_SHEET_DATA);

  readonly isSubmitting = signal(false);

  // Check if opened as bottom sheet (for conditional UI like drag handle)
  readonly isBottomSheet = computed(() => !!this.#bottomSheetRef);

  readonly isEditMode = computed(() => !!this.data.transaction);

  // Date constraints based on budget month/year
  readonly minDate = startOfMonth(
    new Date(this.data.year, this.data.month - 1),
  );
  readonly maxDate = endOfMonth(new Date(this.data.year, this.data.month - 1));

  // Date range validator
  readonly #dateRangeValidator = (
    control: AbstractControl,
  ): ValidationErrors | null => {
    if (!control.value) return null;
    const date = new Date(control.value);
    if (date < this.minDate || date > this.maxDate) {
      return { dateOutOfRange: true };
    }
    return null;
  };

  readonly form = this.#fb.group({
    name: [
      this.data.transaction?.name ?? '',
      [Validators.required, Validators.minLength(2), Validators.maxLength(100)],
    ],
    amount: [
      this.data.transaction?.amount ?? (null as number | null),
      [Validators.required, Validators.min(0.01), Validators.max(999999.99)],
    ],
    transactionDate: [
      this.data.transaction
        ? new Date(this.data.transaction.transactionDate)
        : (new Date() as Date | null),
      [Validators.required, this.#dateRangeValidator],
    ],
    category: [
      this.data.transaction?.category ?? '',
      [Validators.maxLength(50)],
    ],
  });

  // Reactive signal for amount field - enables real-time progress bar updates
  readonly #amountValue = toSignal(
    this.form.controls.amount.valueChanges.pipe(
      startWith(this.form.controls.amount.value),
    ),
  );

  // Budget consumption calculations - uses reactive signal for real-time updates
  // Note: data.consumedAmount already excludes the transaction being edited (see interface doc)
  readonly consumedAmount = computed(() => {
    const formAmount = this.#amountValue() ?? 0;
    return this.data.consumedAmount + formAmount;
  });

  readonly remainingAmount = computed(
    () => this.data.budgetLine.amount - this.consumedAmount(),
  );

  readonly progressPercentage = computed(() => {
    const consumed = this.consumedAmount();
    const planned = this.data.budgetLine.amount;
    if (planned <= 0) return 0;
    return Math.min(100, (consumed / planned) * 100);
  });

  readonly isOverBudget = computed(() => this.remainingAmount() < 0);

  onCancel(): void {
    this.#close(undefined);
  }

  onSubmit(): void {
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    const { name, amount, transactionDate, category } = this.form.getRawValue();

    if (this.isEditMode() && this.data.transaction) {
      // Update mode
      const updateData: TransactionUpdate = {
        name: name!.trim(),
        amount: amount!,
        transactionDate: (transactionDate as Date).toISOString(),
        category: category?.trim() || null,
      };

      this.#close({
        action: 'update',
        id: this.data.transaction.id,
        data: updateData,
      });
    } else {
      // Create mode
      const createData: TransactionCreate = {
        name: name!.trim(),
        amount: amount!,
        kind: this.data.budgetLine.kind,
        transactionDate: (transactionDate as Date).toISOString(),
        category: category?.trim() || null,
        budgetId: this.data.budgetId,
        budgetLineId: this.data.budgetLine.id,
      };

      this.#close({
        action: 'create',
        data: createData,
      });
    }
  }

  // Unified close method for Dialog or BottomSheet
  #close(result: AllocatedTransactionFormDialogResult): void {
    if (this.#dialogRef) {
      this.#dialogRef.close(result);
    } else if (this.#bottomSheetRef) {
      this.#bottomSheetRef.dismiss(result);
    }
  }
}
