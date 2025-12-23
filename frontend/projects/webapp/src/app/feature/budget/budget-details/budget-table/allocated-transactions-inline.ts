import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { BudgetLine, Transaction } from '@pulpe/shared';

@Component({
  selector: 'pulpe-allocated-transactions-inline',
  standalone: true,
  imports: [
    CurrencyPipe,
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
  ],
  template: `
    <div class="px-4 pb-2">
      <!-- Summary Header -->
      <div class="flex justify-between items-center mb-3">
        <div class="flex items-center gap-2">
          <mat-icon class="text-on-surface-variant">receipt_long</mat-icon>
          <span class="text-title-small">Transactions allouées</span>
          <span class="text-label-medium text-on-surface-variant">
            ({{ transactions().length }})
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
        <div class="text-center py-4 text-on-surface-variant">
          <p class="text-body-medium">Aucune transaction allouée</p>
        </div>
      } @else {
        <div class="flex flex-col gap-2">
          @for (tx of transactions(); track tx.id) {
            <div
              class="flex items-center justify-between p-3 bg-surface rounded-lg hover:bg-surface-container-low transition-colors"
            >
              <div class="flex items-center gap-3">
                <span class="text-label-medium text-on-surface-variant">
                  {{ tx.transactionDate | date: 'dd/MM' }}
                </span>
                <span class="text-body-medium">{{ tx.name }}</span>
                @if (tx.category) {
                  <span class="text-label-small text-on-surface-variant">
                    ({{ tx.category }})
                  </span>
                }
              </div>
              <div class="flex items-center gap-2">
                <span class="text-body-medium font-medium">
                  {{
                    tx.amount | currency: 'CHF' : 'symbol' : '1.2-2' : 'de-CH'
                  }}
                </span>
                <button
                  matIconButton
                  matTooltip="Modifier"
                  (click)="edit.emit(tx); $event.stopPropagation()"
                >
                  <mat-icon>edit</mat-icon>
                </button>
                <button
                  matIconButton
                  matTooltip="Supprimer"
                  class="text-error"
                  (click)="onDelete(tx); $event.stopPropagation()"
                >
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </div>
          }
        </div>
      }

      <!-- Consumed/Remaining Summary -->
      <div
        class="mt-3 pt-3 border-t border-outline-variant flex justify-between text-body-medium"
      >
        <span>
          Consommé:
          <span class="font-medium">
            {{
              consumedAmount() | currency: 'CHF' : 'symbol' : '1.2-2' : 'de-CH'
            }}
          </span>
        </span>
        <span [class.text-error]="remainingAmount() < 0">
          Restant:
          <span class="font-medium">
            {{
              remainingAmount() | currency: 'CHF' : 'symbol' : '1.2-2' : 'de-CH'
            }}
          </span>
        </span>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AllocatedTransactionsInline {
  budgetLine = input.required<BudgetLine>();
  transactions = input.required<Transaction[]>();

  add = output<void>();
  edit = output<Transaction>();
  delete = output<string>();

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
