import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  signal,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRippleModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { Transaction } from '@pulpe/shared';

export interface TransactionsListConfig {
  readonly title: string;
  readonly totalAmount?: number;
  readonly emptyStateIcon?: string;
  readonly emptyStateTitle?: string;
  readonly emptyStateSubtitle?: string;
  readonly selectable?: boolean;
  readonly defaultExpanded?: boolean;
}

@Component({
  selector: 'pulpe-transactions-list',
  imports: [
    CurrencyPipe,
    MatIconModule,
    MatDividerModule,
    MatListModule,
    MatCheckboxModule,
    MatRippleModule,
    MatButtonModule,
    MatChipsModule,
  ],
  template: `
    <div
      class="flex flex-col rounded-corner-large overflow-hidden bg-surface-container-low"
    >
      <div
        class="pb-0 p-4 cursor-pointer"
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
                transaction of displayedTransactions();
                track transaction.id;
                let isLast = $last;
                let isOdd = $odd
              ) {
                <mat-list-item
                  matRipple
                  [matRippleDisabled]="!config().selectable"
                  [class.odd-item]="isOdd"
                  [class.income-item]="transaction.kind === 'INCOME'"
                  [class.saving-item]="
                    transaction.kind === 'SAVINGS_CONTRIBUTION'
                  "
                  [class.expense-item]="transaction.kind === 'FIXED_EXPENSE'"
                  [class.!cursor-pointer]="config().selectable"
                  (click)="
                    config().selectable ? toggleSelection(transaction.id) : null
                  "
                >
                  <div
                    matListItemAvatar
                    class="flex justify-center items-center gap-4"
                  >
                    @if (config().selectable) {
                      <mat-checkbox
                        [checked]="isSelected(transaction.id)"
                        (change)="
                          onSelectionChange(transaction.id, $event.checked)
                        "
                        (click)="$event.stopPropagation()"
                      />
                    }
                    <div
                      class="flex justify-center items-center size-11 bg-surface rounded-full"
                    >
                      @switch (transaction.kind) {
                        @case ('INCOME') {
                          <mat-icon class="!text-(--pulpe-financial-income)">
                            trending_up
                          </mat-icon>
                        }
                        @case ('SAVINGS_CONTRIBUTION') {
                          <mat-icon class="!text-(--pulpe-financial-savings)">
                            savings
                          </mat-icon>
                        }
                        @case ('FIXED_EXPENSE') {
                          <mat-icon class="!text-(--pulpe-financial-expense)">
                            trending_down
                          </mat-icon>
                        }
                        @default {
                          <mat-icon class="!text-(--pulpe-financial-expense)">
                            trending_down
                          </mat-icon>
                        }
                      }
                    </div>
                  </div>
                  <div matListItemTitle>{{ transaction.name }}</div>
                  @if (transaction.category) {
                    <div matListItemLine class="text-body-small italic">
                      {{ transaction.category }}
                    </div>
                  }
                  <div
                    matListItemMeta
                    class="!flex !h-full !items-center !gap-3"
                  >
                    <span>
                      {{ transaction.kind === 'INCOME' ? '+' : '-'
                      }}{{
                        transaction.amount
                          | currency: 'CHF' : 'symbol' : '1.0-2' : 'fr-CH'
                      }}
                    </span>
                  </div>
                </mat-list-item>
                @if (!isLast) {
                  <mat-divider></mat-divider>
                }
              }
            </mat-list>

            @if (hasMoreTransactions()) {
              <div class="flex justify-center p-4">
                <button
                  matButton
                  (click)="showAllTransactions()"
                  class="text-primary"
                >
                  Voir plus ({{ remainingTransactionsCount() }})
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

      @include mat.list-overrides(
        (
          list-item-leading-avatar-color: none,
          list-item-leading-avatar-size: fit-content,
          list-item-two-line-container-height: 71px,
          list-item-one-line-container-height: 71px,
          list-item-trailing-supporting-text-size: var(
              --mat-sys-title-medium-size
            ),
          list-item-trailing-supporting-text-color: var(
              --pulpe-financial-expense
            ),
        )
      );

      .mat-mdc-list-item:hover {
        background-color: rgba(0, 0, 0, 0.04);
      }
    }

    .odd-item {
      @include mat.list-overrides(
        (
          list-item-container-color: var(--mat-sys-surface-container),
        )
      );
    }

    .income-item {
      @include mat.list-overrides(
        (
          list-item-trailing-supporting-text-color: var(
              --pulpe-financial-income
            ),
        )
      );
    }

    .saving-item {
      @include mat.list-overrides(
        (
          list-item-trailing-supporting-text-color: var(
              --pulpe-financial-savings
            ),
        )
      );
    }

    .expense-item {
      @include mat.list-overrides(
        (
          list-item-trailing-supporting-text-color: var(
              --pulpe-financial-expense
            ),
        )
      );
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionsList {
  readonly transactions = input.required<Transaction[]>();
  readonly config = input.required<TransactionsListConfig>();
  readonly selectedTransactions = model<string[]>([]);

  private readonly expandedState = signal<boolean | null>(null);
  protected readonly showAllItems = signal(false);
  private readonly maxItemsToShow = 5;

  protected readonly isExpanded = computed(() => {
    const explicitState = this.expandedState();
    if (explicitState !== null) {
      return explicitState;
    }
    return this.config().defaultExpanded ?? true;
  });

  protected readonly displayedTransactions = computed(() => {
    const allTransactions = this.transactions();
    if (!this.isExpanded()) {
      return [];
    }
    if (this.showAllItems() || allTransactions.length <= this.maxItemsToShow) {
      return allTransactions;
    }
    return allTransactions.slice(0, this.maxItemsToShow);
  });

  protected readonly hasMoreTransactions = computed(() => {
    return (
      this.transactions().length > this.maxItemsToShow && !this.showAllItems()
    );
  });

  protected readonly remainingTransactionsCount = computed(() => {
    return Math.max(0, this.transactions().length - this.maxItemsToShow);
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

  onSelectionChange(transactionId: string, selected: boolean): void {
    const currentSelection = this.selectedTransactions();
    if (selected) {
      this.selectedTransactions.set([...currentSelection, transactionId]);
    } else {
      this.selectedTransactions.set(
        currentSelection.filter((id) => id !== transactionId),
      );
    }
  }

  toggleSelection(transactionId: string): void {
    const isCurrentlySelected = this.isSelected(transactionId);
    this.onSelectionChange(transactionId, !isCurrentlySelected);
  }

  isSelected(transactionId: string): boolean {
    return this.selectedTransactions().includes(transactionId);
  }
}
