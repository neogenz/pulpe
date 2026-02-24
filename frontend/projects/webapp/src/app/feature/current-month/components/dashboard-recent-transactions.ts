import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import type { Transaction, TransactionKind } from 'pulpe-shared';

const KIND_ICONS: Record<TransactionKind, string> = {
  income: 'arrow_upward',
  expense: 'arrow_downward',
  saving: 'savings',
};

@Component({
  selector: 'pulpe-dashboard-recent-transactions',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col w-full h-full">
      <div class="mb-4 px-1 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-full bg-tertiary/10 text-tertiary flex items-center justify-center flex-shrink-0"
          >
            <mat-icon>receipt_long</mat-icon>
          </div>
          <div>
            <h2
              class="text-title-medium font-bold text-on-surface leading-tight"
            >
              Dernières transactions
            </h2>
            <p
              class="text-body-small text-on-surface-variant font-medium mt-0.5"
            >
              Ce mois ({{ transactions().length }})
            </p>
          </div>
        </div>
        <button
          class="text-label-small font-medium text-primary hover:text-primary/80 transition-colors"
          (click)="viewBudget.emit()"
        >
          Voir tout
        </button>
      </div>

      <div class="bg-surface-container-low rounded-3xl py-3 px-3 flex-1">
        @if (transactions().length > 0) {
          <div class="flex flex-col gap-1">
            @for (tx of transactions(); track tx.id) {
              <div
                class="flex items-center gap-3 p-3 rounded-2xl hover:bg-surface-container-low transition-colors"
              >
                <div
                  class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  [ngClass]="kindClasses(tx.kind)"
                >
                  <mat-icon class="text-[20px]">
                    {{ kindIcon(tx.kind) }}
                  </mat-icon>
                </div>
                <div class="flex-1 min-w-0">
                  <p
                    class="text-body-medium font-bold text-on-surface truncate ph-no-capture"
                  >
                    {{ tx.name }}
                  </p>
                  <p
                    class="text-body-small text-on-surface-variant font-medium"
                  >
                    {{ tx.transactionDate | date: 'dd MMM' : '' : 'fr-CH' }}
                  </p>
                </div>
                <span
                  class="text-label-large whitespace-nowrap ml-4 font-semibold tabular-nums ph-no-capture"
                  [ngClass]="{
                    'text-success': tx.kind === 'income',
                    'text-on-surface-variant opacity-80': tx.kind !== 'income',
                  }"
                >
                  {{ tx.kind === 'income' ? '+' : '-'
                  }}{{ tx.amount | number: '1.2-2' : 'de-CH' }} CHF
                </span>
              </div>
            }
          </div>
        } @else {
          <div
            class="p-8 flex flex-col items-center justify-center text-center h-full"
          >
            <div
              class="w-16 h-16 rounded-full bg-tertiary/10 text-tertiary flex items-center justify-center mb-4"
            >
              <mat-icon class="scale-150">receipt_long</mat-icon>
            </div>
            <h3 class="text-title-medium font-bold text-on-surface mb-1">
              Aucune transaction
            </h3>
            <p class="text-body-medium text-on-surface-variant">
              Aucune transaction ce mois
            </p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class DashboardRecentTransactions {
  readonly transactions = input.required<Transaction[]>();
  readonly viewBudget = output<void>();

  protected kindIcon(kind: TransactionKind): string {
    return KIND_ICONS[kind];
  }

  protected kindClasses(kind: TransactionKind): Record<string, boolean> {
    return {
      'bg-success/10 text-success': kind === 'income',
      'bg-info/10 text-info': kind === 'saving',
      'bg-surface-container-high text-on-surface-variant': kind === 'expense',
    };
  }
}
