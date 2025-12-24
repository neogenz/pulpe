import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import type { Transaction } from '@pulpe/shared';
import type {
  AllocatedTransactionsDialogData,
  AllocatedTransactionsDialogResult,
} from './allocated-transactions-dialog';

@Component({
  selector: 'pulpe-allocated-transactions-bottom-sheet',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
  ],
  template: `
    <div class="flex flex-col gap-4 pb-6">
      <!-- Drag indicator -->
      <div
        class="w-9 h-1 bg-outline-variant rounded-sm mx-auto mt-3 mb-2"
      ></div>

      <!-- Header -->
      <div class="flex justify-between items-center px-4">
        <h2 class="text-title-large text-on-surface m-0">
          {{ data.budgetLine.name }}
        </h2>
        <button matIconButton (click)="close()" aria-label="Fermer">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Summary -->
      <div class="grid grid-cols-3 gap-2 px-4">
        <div class="text-center p-3 bg-surface-container rounded-lg">
          <div class="text-label-small text-on-surface-variant">Prévu</div>
          <div class="text-title-small font-semibold">
            {{ data.budgetLine.amount | currency: 'CHF' : 'symbol' : '1.0-0' }}
          </div>
        </div>
        <div class="text-center p-3 bg-surface-container rounded-lg">
          <div class="text-label-small text-on-surface-variant">Consommé</div>
          <div class="text-title-small font-semibold">
            {{
              data.consumption.consumed | currency: 'CHF' : 'symbol' : '1.0-0'
            }}
          </div>
        </div>
        <div class="text-center p-3 bg-surface-container rounded-lg">
          <div class="text-label-small text-on-surface-variant">Disponible</div>
          <div
            class="text-title-small font-semibold"
            [class.text-error]="data.consumption.remaining < 0"
            [class.text-financial-income]="data.consumption.remaining >= 0"
          >
            {{
              data.consumption.remaining | currency: 'CHF' : 'symbol' : '1.0-0'
            }}
          </div>
        </div>
      </div>

      <!-- Progress bar -->
      <div class="px-4">
        <mat-progress-bar
          mode="determinate"
          [value]="consumptionPercentage"
          [class.warn-bar]="consumptionPercentage > 100"
        />
        <div class="text-label-small text-on-surface-variant text-center mt-1">
          {{ consumptionPercentage | number: '1.0-0' }}% utilisé
        </div>
      </div>

      <!-- Transactions list -->
      <div class="px-4 max-h-[40vh] overflow-y-auto">
        @if (data.consumption.allocatedTransactions.length > 0) {
          <div class="flex flex-col gap-2">
            @for (tx of data.consumption.allocatedTransactions; track tx.id) {
              <div
                class="flex items-center justify-between p-3 bg-surface-container-low rounded-lg"
              >
                <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span class="text-body-medium font-medium truncate">
                    {{ tx.name }}
                  </span>
                  <span class="text-label-small text-on-surface-variant">
                    {{ tx.transactionDate | date: 'dd/MM/yyyy' }}
                  </span>
                </div>
                <div class="flex items-center gap-2">
                  <span
                    class="text-body-medium font-semibold whitespace-nowrap"
                  >
                    {{ tx.amount | currency: 'CHF' : 'symbol' : '1.2-2' }}
                  </span>
                  <button
                    matIconButton
                    (click)="deleteTransaction(tx)"
                    aria-label="Supprimer la transaction"
                    class="text-error !w-9 !h-9"
                  >
                    <mat-icon class="!text-xl">delete</mat-icon>
                  </button>
                </div>
              </div>
            }
          </div>
        } @else {
          <div class="text-center py-6 text-on-surface-variant">
            <mat-icon class="!text-4xl mb-2">receipt_long</mat-icon>
            <p class="text-body-medium">Aucune transaction</p>
          </div>
        }
      </div>

      <!-- Action button -->
      <div class="px-4 pt-2">
        <button matButton="filled" (click)="addTransaction()" class="w-full">
          <mat-icon>add</mat-icon>
          Nouvelle transaction
        </button>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .warn-bar {
      --mat-progress-bar-active-indicator-color: var(--mat-sys-error);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AllocatedTransactionsBottomSheet {
  readonly data = inject<AllocatedTransactionsDialogData>(
    MAT_BOTTOM_SHEET_DATA,
  );
  readonly #bottomSheetRef = inject(
    MatBottomSheetRef<
      AllocatedTransactionsBottomSheet,
      AllocatedTransactionsDialogResult
    >,
  );

  readonly consumptionPercentage =
    this.data.budgetLine.amount > 0
      ? Math.round(
          (this.data.consumption.consumed / this.data.budgetLine.amount) * 100,
        )
      : 0;

  close(): void {
    this.#bottomSheetRef.dismiss();
  }

  addTransaction(): void {
    this.#bottomSheetRef.dismiss({ action: 'add' });
  }

  deleteTransaction(transaction: Transaction): void {
    this.#bottomSheetRef.dismiss({ action: 'delete', transaction });
  }
}
