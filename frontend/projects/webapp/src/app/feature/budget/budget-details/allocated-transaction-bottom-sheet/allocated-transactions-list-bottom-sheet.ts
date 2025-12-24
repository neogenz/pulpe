import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import {
  MatBottomSheet,
  MatBottomSheetRef,
  MAT_BOTTOM_SHEET_DATA,
} from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import type {
  BudgetLine,
  Transaction,
  TransactionCreate,
  TransactionUpdate,
} from '@pulpe/shared';
import { firstValueFrom } from 'rxjs';
import { BudgetLineApi } from '../budget-line-api/budget-line-api';
import { TransactionApi } from '@core/transaction';
import { TransactionCard } from '../budget-table/transaction-card';
import {
  AllocatedTransactionBottomSheet,
  type AllocatedTransactionBottomSheetResult,
} from './allocated-transaction-bottom-sheet';

export interface AllocatedTransactionsListBottomSheetData {
  budgetLine: BudgetLine;
}

export interface AllocatedTransactionsListBottomSheetResult {
  updated: boolean;
}

@Component({
  selector: 'pulpe-allocated-transactions-list-bottom-sheet',
  standalone: true,
  imports: [
    CurrencyPipe,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TransactionCard,
  ],
  providers: [BudgetLineApi],
  template: `
    <div class="flex flex-col max-h-[85dvh]">
      <!-- Drag indicator -->
      <div
        class="w-9 h-1 bg-outline-variant rounded-sm mx-auto mt-3 mb-2"
      ></div>

      <!-- Header -->
      <div class="flex justify-between items-center px-4 pb-3">
        <div class="min-w-0">
          <h2 class="text-title-large text-on-surface m-0">Transactions</h2>
          <p class="text-body-medium text-on-surface-variant truncate">
            {{ data.budgetLine.name }}
          </p>
        </div>
        <button
          matIconButton
          (click)="close()"
          aria-label="Fermer"
          class="flex-shrink-0"
        >
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Summary Bar -->
      <div
        class="mx-4 p-3 bg-surface-container rounded-lg grid grid-cols-3 gap-2 text-center"
      >
        <div>
          <span class="text-label-small text-on-surface-variant block"
            >Prévu</span
          >
          <div class="text-body-medium font-medium">
            {{
              data.budgetLine.amount
                | currency: 'CHF' : 'symbol' : '1.2-2' : 'de-CH'
            }}
          </div>
        </div>
        <div>
          <span class="text-label-small text-on-surface-variant block"
            >Consommé</span
          >
          <div
            class="text-body-medium font-medium"
            [class.text-error]="consumedAmount() > data.budgetLine.amount"
          >
            {{
              consumedAmount() | currency: 'CHF' : 'symbol' : '1.2-2' : 'de-CH'
            }}
          </div>
        </div>
        <div>
          <span class="text-label-small text-on-surface-variant block"
            >Restant</span
          >
          <div
            class="text-body-medium font-medium"
            [class.text-error]="remainingAmount() < 0"
            [class.text-pulpe-financial-savings]="remainingAmount() >= 0"
          >
            {{
              remainingAmount() | currency: 'CHF' : 'symbol' : '1.2-2' : 'de-CH'
            }}
          </div>
        </div>
      </div>

      <!-- Transaction List (Scrollable) -->
      <div class="flex-1 overflow-y-auto px-4 py-4 min-h-0">
        @if (transactionsResource.isLoading()) {
          <div class="flex justify-center py-8">
            <mat-spinner diameter="40" />
          </div>
        } @else if (transactionsResource.error()) {
          <div class="text-error text-center py-8">
            <mat-icon aria-hidden="true" class="text-4xl mb-2"
              >error_outline</mat-icon
            >
            <p class="text-body-medium">
              Erreur lors du chargement des transactions
            </p>
          </div>
        } @else if (transactions().length === 0) {
          <div class="text-center py-8 text-on-surface-variant">
            <mat-icon aria-hidden="true" class="text-5xl mb-2 opacity-50"
              >inbox</mat-icon
            >
            <p class="text-body-medium">Aucune transaction allouée</p>
          </div>
        } @else {
          <div class="flex flex-col gap-2">
            @for (tx of transactions(); track tx.id) {
              <pulpe-transaction-card
                [transaction]="tx"
                [kind]="data.budgetLine.kind"
                [isMobile]="true"
                (edit)="editTransaction(tx)"
                (delete)="deleteTransaction(tx)"
              />
            }
          </div>
        }
      </div>

      <!-- Bottom Actions -->
      <div class="p-4 border-t border-outline-variant bg-surface">
        <button
          matButton="tonal"
          class="w-full"
          (click)="addTransaction()"
          [disabled]="isProcessing()"
        >
          <mat-icon>add</mat-icon>
          Ajouter une transaction
        </button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AllocatedTransactionsListBottomSheet {
  readonly #bottomSheetRef = inject(
    MatBottomSheetRef<
      AllocatedTransactionsListBottomSheet,
      AllocatedTransactionsListBottomSheetResult
    >,
  );
  readonly #bottomSheet = inject(MatBottomSheet);
  readonly #budgetLineApi = inject(BudgetLineApi);
  readonly #transactionApi = inject(TransactionApi);

  protected readonly data = inject<AllocatedTransactionsListBottomSheetData>(
    MAT_BOTTOM_SHEET_DATA,
  );

  readonly #hasUpdates = signal(false);
  readonly isProcessing = signal(false);

  readonly transactionsResource = resource({
    loader: async () => {
      const response = await firstValueFrom(
        this.#budgetLineApi.getAllocatedTransactions$(this.data.budgetLine.id),
      );
      return response.data;
    },
  });

  readonly transactions = computed<Transaction[]>(
    () => this.transactionsResource.value() ?? [],
  );

  readonly consumedAmount = computed(() =>
    this.transactions().reduce((sum, t) => sum + t.amount, 0),
  );

  readonly remainingAmount = computed(
    () => this.data.budgetLine.amount - this.consumedAmount(),
  );

  protected close(): void {
    this.#bottomSheetRef.dismiss({ updated: this.#hasUpdates() });
  }

  protected addTransaction(): void {
    const sheetRef = this.#bottomSheet.open(AllocatedTransactionBottomSheet, {
      data: {
        budgetLine: this.data.budgetLine,
        mode: 'create' as const,
      },
    });

    sheetRef
      .afterDismissed()
      .subscribe(
        (result: AllocatedTransactionBottomSheetResult | undefined) => {
          if (result?.mode === 'create') {
            this.#createTransaction(result.transaction);
          }
        },
      );
  }

  protected editTransaction(transaction: Transaction): void {
    const sheetRef = this.#bottomSheet.open(AllocatedTransactionBottomSheet, {
      data: {
        budgetLine: this.data.budgetLine,
        transaction,
        mode: 'edit' as const,
      },
    });

    sheetRef
      .afterDismissed()
      .subscribe(
        (result: AllocatedTransactionBottomSheetResult | undefined) => {
          if (result?.mode === 'edit') {
            this.#updateTransaction(transaction.id, result.transaction);
          }
        },
      );
  }

  protected async deleteTransaction(transaction: Transaction): Promise<void> {
    if (!confirm(`Supprimer la transaction "${transaction.name}" ?`)) {
      return;
    }

    this.isProcessing.set(true);
    try {
      await firstValueFrom(this.#transactionApi.remove$(transaction.id));
      this.#hasUpdates.set(true);
      this.transactionsResource.reload();
    } catch (error) {
      console.error('Error deleting transaction:', error);
    } finally {
      this.isProcessing.set(false);
    }
  }

  async #createTransaction(
    transactionData: AllocatedTransactionBottomSheetResult['transaction'],
  ): Promise<void> {
    this.isProcessing.set(true);
    try {
      await firstValueFrom(
        this.#transactionApi.create$(transactionData as TransactionCreate),
      );
      this.#hasUpdates.set(true);
      this.transactionsResource.reload();
    } catch (error) {
      console.error('Error creating transaction:', error);
    } finally {
      this.isProcessing.set(false);
    }
  }

  async #updateTransaction(
    id: string,
    transactionData: AllocatedTransactionBottomSheetResult['transaction'],
  ): Promise<void> {
    this.isProcessing.set(true);
    try {
      await firstValueFrom(
        this.#transactionApi.update$(id, transactionData as TransactionUpdate),
      );
      this.#hasUpdates.set(true);
      this.transactionsResource.reload();
    } catch (error) {
      console.error('Error updating transaction:', error);
    } finally {
      this.isProcessing.set(false);
    }
  }
}
