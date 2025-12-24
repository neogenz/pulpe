import {
  type AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  MatBottomSheetRef,
  MAT_BOTTOM_SHEET_DATA,
} from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import type {
  BudgetLine,
  Transaction,
  TransactionCreate,
  TransactionUpdate,
} from '@pulpe/shared';
import { format } from 'date-fns';

export interface AllocatedTransactionBottomSheetData {
  budgetLine: BudgetLine;
  transaction?: Transaction;
  mode: 'create' | 'edit';
}

export interface AllocatedTransactionBottomSheetResult {
  transaction: TransactionCreate | TransactionUpdate;
  mode: 'create' | 'edit';
}

@Component({
  selector: 'pulpe-allocated-transaction-bottom-sheet',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
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
          {{
            data.mode === 'create'
              ? 'Nouvelle transaction'
              : 'Modifier la transaction'
          }}
        </h2>
        <button matIconButton (click)="close()" aria-label="Fermer">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Budget Line Context -->
      <div class="p-3 bg-surface-container rounded-lg">
        <span class="text-label-medium text-on-surface-variant">
          Prévision:
        </span>
        <span class="text-body-medium ml-2">{{ data.budgetLine.name }}</span>
      </div>

      <!-- Form -->
      <form
        [formGroup]="form"
        (ngSubmit)="onSubmit()"
        class="flex flex-col gap-4"
        novalidate
      >
        <!-- Amount Field -->
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Montant</mat-label>
          <input
            matInput
            #amountInput
            type="number"
            inputmode="decimal"
            placeholder="0.00"
            formControlName="amount"
            step="0.01"
            min="0.01"
            class="text-right"
            required
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
            <mat-error>Le montant doit être positif</mat-error>
          }
        </mat-form-field>

        <!-- Name Field -->
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Nom</mat-label>
          <input
            matInput
            formControlName="name"
            placeholder="Ex: Courses supermarché"
          />
          @if (
            form.get('name')?.hasError('required') && form.get('name')?.touched
          ) {
            <mat-error>Le nom est requis</mat-error>
          }
        </mat-form-field>

        <!-- Date Field -->
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Date</mat-label>
          <input matInput type="date" formControlName="transactionDate" />
          @if (
            form.get('transactionDate')?.hasError('required') &&
            form.get('transactionDate')?.touched
          ) {
            <mat-error>La date est requise</mat-error>
          }
        </mat-form-field>

        <!-- Category Field -->
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Catégorie (optionnel)</mat-label>
          <input
            matInput
            formControlName="category"
            placeholder="Ex: Alimentation"
            maxlength="50"
          />
          <mat-hint align="end">
            {{ form.get('category')?.value?.length || 0 }}/50
          </mat-hint>
        </mat-form-field>
      </form>

      <!-- Action Buttons -->
      <div class="flex gap-3 pt-4 pb-6 border-t border-outline-variant">
        <button matButton (click)="close()" class="flex-1">Annuler</button>
        <button
          matButton="filled"
          (click)="onSubmit()"
          [disabled]="form.invalid"
          class="flex-1"
        >
          {{ data.mode === 'create' ? 'Ajouter' : 'Enregistrer' }}
        </button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AllocatedTransactionBottomSheet implements AfterViewInit {
  readonly #fb = inject(FormBuilder);
  readonly #bottomSheetRef = inject(
    MatBottomSheetRef<
      AllocatedTransactionBottomSheet,
      AllocatedTransactionBottomSheetResult
    >,
  );

  protected readonly data = inject<AllocatedTransactionBottomSheetData>(
    MAT_BOTTOM_SHEET_DATA,
  );

  protected readonly amountInput =
    viewChild<ElementRef<HTMLInputElement>>('amountInput');

  readonly form = this.#fb.nonNullable.group({
    name: [
      this.data.transaction?.name ?? '',
      [Validators.required, Validators.minLength(1), Validators.maxLength(100)],
    ],
    amount: this.#fb.control<number | null>(
      this.data.transaction?.amount ?? null,
      [Validators.required, Validators.min(0.01)],
    ),
    transactionDate: [
      this.data.transaction?.transactionDate
        ? format(new Date(this.data.transaction.transactionDate), 'yyyy-MM-dd')
        : format(new Date(), 'yyyy-MM-dd'),
      Validators.required,
    ],
    category: [this.data.transaction?.category ?? '', Validators.maxLength(50)],
  });

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.amountInput()?.nativeElement?.focus();
    }, 200);
  }

  protected onSubmit(): void {
    if (!this.form.valid) {
      this.form.markAllAsTouched();
      return;
    }

    const formValue = this.form.getRawValue();

    if (this.data.mode === 'create') {
      const transaction: TransactionCreate = {
        budgetId: this.data.budgetLine.budgetId,
        budgetLineId: this.data.budgetLine.id,
        name: formValue.name.trim(),
        amount: formValue.amount!,
        kind: this.data.budgetLine.kind,
        transactionDate: new Date(formValue.transactionDate).toISOString(),
        category: formValue.category.trim() || null,
      };
      this.#bottomSheetRef.dismiss({ transaction, mode: 'create' });
    } else {
      const transaction: TransactionUpdate = {
        name: formValue.name.trim(),
        amount: formValue.amount!,
        transactionDate: new Date(formValue.transactionDate).toISOString(),
        category: formValue.category.trim() || null,
      };
      this.#bottomSheetRef.dismiss({ transaction, mode: 'edit' });
    }
  }

  protected close(): void {
    this.#bottomSheetRef.dismiss();
  }
}
