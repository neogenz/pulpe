import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { type Transaction } from '@pulpe/shared';
import { TransactionItem, type TransactionItemData } from './transaction-item';

export interface TransactionsListConfig {
  readonly title: string;
  readonly totalAmount?: number;
  readonly emptyStateIcon?: string;
  readonly emptyStateTitle?: string;
  readonly emptyStateSubtitle?: string;
  readonly selectable?: boolean;
  readonly defaultExpanded?: boolean;
  readonly deletable?: boolean;
  readonly editable?: boolean;
}

@Component({
  selector: 'pulpe-transactions-list',
  imports: [
    CurrencyPipe,
    MatIconModule,
    MatDividerModule,
    MatListModule,
    MatButtonModule,
    MatChipsModule,
    TransactionItem,
  ],
  template: `
    <div
      class="flex flex-col rounded-corner-large overflow-hidden bg-surface-container-low"
    >
      <div
        class="p-4 cursor-pointer"
        role="button"
        tabindex="0"
        (click)="toggleExpanded()"
        (keyup.enter)="toggleExpanded()"
        (keyup.space)="toggleExpanded()"
      >
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-3">
            <h2 class="text-headline-small">{{ config().title }}</h2>
            @if (config().totalAmount !== undefined) {
              <span
                class="text-title-medium font-medium"
                [class.text-pulpe-financial-income]="config().totalAmount! > 0"
                [class.text-pulpe-financial-expense]="config().totalAmount! < 0"
                [class.text-on-surface]="config().totalAmount! === 0"
              >
                {{ config().totalAmount! > 0 ? '+' : ''
                }}{{
                  config().totalAmount!
                    | currency: 'CHF' : 'symbol' : '1.0-2' : 'fr-CH'
                }}
              </span>
            }
            <mat-chip-set>
              <mat-chip>
                {{ transactions().length }}
                {{
                  transactions().length === 1 ? 'transaction' : 'transactions'
                }}
              </mat-chip>
            </mat-chip-set>
          </div>
          <mat-icon
            class="transition-transform duration-200"
            [class.rotate-180]="!isExpanded()"
          >
            expand_less
          </mat-icon>
        </div>
      </div>

      @if (isExpanded()) {
        <div>
          @if (transactions().length === 0) {
            <div
              class="flex flex-col items-center justify-center py-8 text-center"
            >
              <mat-icon
                class="text-(--color-outline) mb-3"
                style="font-size: 48px; width: 48px; height: 48px;"
              >
                {{ config().emptyStateIcon || 'inbox' }}
              </mat-icon>
              <p class="text-body-large text-(--color-on-surface-variant) mb-1">
                {{ config().emptyStateTitle || 'Aucune transaction' }}
              </p>
              <p class="text-body-small text-(--color-outline)">
                {{
                  config().emptyStateSubtitle ||
                    'Les transactions apparaîtront ici'
                }}
              </p>
            </div>
          } @else {
            <mat-list class="!pb-0">
              @for (
                vm of displayedTransactions().items;
                track vm.id;
                let isLast = $last;
                let isOdd = $odd
              ) {
                <pulpe-transaction-item
                  [data]="vm"
                  [selectable]="config().selectable ?? false"
                  [deletable]="config().deletable ?? false"
                  [editable]="config().editable ?? false"
                  [isOdd]="isOdd"
                  (selectionChange)="toggleSelection(vm.id, $event)"
                  (deleteClick)="deleteTransaction.emit(vm.id)"
                  (editClick)="editTransaction.emit(vm.id)"
                />
                @if (!isLast) {
                  <mat-divider></mat-divider>
                }
              }
            </mat-list>

            @if (displayedTransactions().hasMore) {
              <div class="flex justify-center p-4">
                <button
                  matButton
                  (click)="showAllTransactions()"
                  class="text-primary"
                >
                  Voir plus ({{ displayedTransactions().remaining }})
                </button>
              </div>
            }
          }
        </div>
      }
    </div>
  `,
  styles: `
    @use '@angular/material' as mat;
    :host {
      color: var(--mat-sys-on-surface);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionsList {
  readonly transactions = input.required<Transaction[]>();
  readonly config = input.required<TransactionsListConfig>();
  readonly selectedTransactions = model<string[]>([]);
  readonly deleteTransaction = output<string>();
  readonly editTransaction = output<string>();

  private readonly expandedState = signal<boolean | null>(null);
  protected readonly showAllItems = signal(false);
  private readonly INITIAL_DISPLAY_COUNT = 5;

  protected readonly isExpanded = computed(() => {
    const explicitState = this.expandedState();
    if (explicitState !== null) {
      return explicitState;
    }
    return this.config().defaultExpanded ?? true;
  });

  readonly #transactionViewModels = computed(() => {
    const transactions = this.transactions();
    const selectedIds = new Set(this.selectedTransactions());

    return transactions.map(
      (transaction) =>
        ({
          ...transaction,
          isSelected: selectedIds.has(transaction.id),
        }) as TransactionItemData,
    );
  });

  protected readonly displayedTransactions = computed(() => {
    const all = this.#transactionViewModels();
    const expanded = this.isExpanded();
    const showAll = this.showAllItems();

    if (!expanded) {
      return { items: [], hasMore: false, remaining: 0 };
    }

    const total = all.length;
    const shouldShowAll = showAll || total <= this.INITIAL_DISPLAY_COUNT;

    return {
      items: shouldShowAll ? all : all.slice(0, this.INITIAL_DISPLAY_COUNT),
      hasMore: !shouldShowAll && total > this.INITIAL_DISPLAY_COUNT,
      remaining: Math.max(0, total - this.INITIAL_DISPLAY_COUNT),
    };
  });

  protected toggleExpanded(): void {
    const currentExpanded = this.isExpanded();
    this.expandedState.set(!currentExpanded);
    if (!this.isExpanded()) {
      this.showAllItems.set(false);
    }
  }

  protected showAllTransactions(): void {
    this.showAllItems.set(true);
  }

  toggleSelection(transactionId: string, selected: boolean): void {
    const currentSelection = this.selectedTransactions();
    if (selected) {
      this.selectedTransactions.set([...currentSelection, transactionId]);
    } else {
      this.selectedTransactions.set(
        currentSelection.filter((id) => id !== transactionId),
      );
    }
  }
}
