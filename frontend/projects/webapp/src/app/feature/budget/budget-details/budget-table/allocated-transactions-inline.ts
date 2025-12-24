import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { BudgetLine, Transaction } from '@pulpe/shared';
import { TransactionCard } from './transaction-card';

@Component({
  selector: 'pulpe-allocated-transactions-inline',
  standalone: true,
  imports: [CurrencyPipe, MatButtonModule, MatIconModule, TransactionCard],
  template: `
    @if (isMobile()) {
      <!-- Mobile: Summary card only -->
      <div class="p-4">
        <button
          type="button"
          class="w-full flex items-center gap-3 p-4 bg-surface-container rounded-lg hover:bg-surface-container-high active:bg-surface-container-highest transition-colors text-left"
          (click)="openDetails.emit(); $event.stopPropagation()"
        >
          <div
            class="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center flex-shrink-0"
          >
            <mat-icon class="text-on-primary-container">receipt_long</mat-icon>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-body-medium font-medium">
              {{ transactions().length }}
              transaction{{ transactions().length > 1 ? 's' : '' }}
            </div>
            <div class="text-label-medium text-on-surface-variant">
              Consommé
              {{
                consumedAmount()
                  | currency: 'CHF' : 'symbol' : '1.2-2' : 'de-CH'
              }}
            </div>
          </div>
          <div class="flex flex-col items-end flex-shrink-0">
            <span
              class="text-body-medium font-semibold"
              [class.text-error]="remainingAmount() < 0"
              [class.text-pulpe-financial-savings]="remainingAmount() >= 0"
            >
              {{
                remainingAmount()
                  | currency: 'CHF' : 'symbol' : '1.2-2' : 'de-CH'
              }}
            </span>
            <span class="text-label-small text-on-surface-variant"
              >restant</span
            >
          </div>
          <mat-icon class="text-on-surface-variant flex-shrink-0"
            >chevron_right</mat-icon
          >
        </button>
      </div>
    } @else {
      <!-- Desktop: Full list with cards -->
      <div class="px-4 pb-4">
        <!-- Header -->
        <div class="flex justify-between items-center mb-3">
          <div class="flex items-center gap-2">
            <mat-icon class="text-on-surface-variant">receipt_long</mat-icon>
            <span class="text-title-small">Transactions allouées</span>
            <span
              class="text-label-medium text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full"
            >
              {{ transactions().length }}
            </span>
          </div>
          <button
            matButton="tonal"
            (click)="add.emit(); $event.stopPropagation()"
          >
            <mat-icon>add</mat-icon>
            Ajouter
          </button>
        </div>

        <!-- Transactions List -->
        @if (transactions().length === 0) {
          <div class="text-center py-6 text-on-surface-variant">
            <mat-icon class="text-4xl mb-2 opacity-50">inbox</mat-icon>
            <p class="text-body-medium">Aucune transaction allouée</p>
          </div>
        } @else {
          <div class="flex flex-col gap-2">
            @for (tx of transactions(); track tx.id) {
              <pulpe-transaction-card
                [transaction]="tx"
                [kind]="budgetLine().kind"
                [isMobile]="false"
                (edit)="edit.emit(tx)"
                (delete)="onDelete(tx)"
              />
            }
          </div>
        }

        <!-- Summary Footer -->
        <div
          class="mt-4 pt-3 border-t border-outline-variant grid grid-cols-2 gap-4"
        >
          <div>
            <span class="text-label-medium text-on-surface-variant"
              >Consommé</span
            >
            <div class="text-title-small font-medium">
              {{
                consumedAmount()
                  | currency: 'CHF' : 'symbol' : '1.2-2' : 'de-CH'
              }}
            </div>
          </div>
          <div class="text-right">
            <span class="text-label-medium text-on-surface-variant"
              >Restant</span
            >
            <div
              class="text-title-small font-medium"
              [class.text-error]="remainingAmount() < 0"
              [class.text-pulpe-financial-savings]="remainingAmount() >= 0"
            >
              {{
                remainingAmount()
                  | currency: 'CHF' : 'symbol' : '1.2-2' : 'de-CH'
              }}
            </div>
          </div>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AllocatedTransactionsInline {
  budgetLine = input.required<BudgetLine>();
  transactions = input.required<Transaction[]>();
  isMobile = input<boolean>(false);

  add = output<void>();
  edit = output<Transaction>();
  delete = output<string>();
  openDetails = output<void>();

  consumedAmount = computed(() =>
    this.transactions().reduce((sum, tx) => sum + tx.amount, 0),
  );

  remainingAmount = computed(
    () => this.budgetLine().amount - this.consumedAmount(),
  );

  protected onDelete(tx: Transaction): void {
    if (confirm(`Supprimer la transaction "${tx.name}" ?`)) {
      this.delete.emit(tx.id);
    }
  }
}
