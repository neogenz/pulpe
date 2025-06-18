import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { Transaction } from '@pulpe/shared';

export interface TransactionsListConfig {
  readonly title: string;
  readonly totalAmount?: number;
  readonly emptyStateIcon?: string;
  readonly emptyStateTitle?: string;
  readonly emptyStateSubtitle?: string;
}

@Component({
  selector: 'pulpe-transactions-list',
  imports: [CurrencyPipe, MatIconModule, MatDividerModule, MatListModule],
  template: `
    <div
      class="flex flex-col rounded-corner-large overflow-hidden bg-surface-container-low max-h-[50vh] 2xl:h-full 2xl:max-h-none"
    >
      <div class="pb-0 p-4">
        <div class="flex justify-between items-start mb-1">
          <h2 class="text-headline-small">{{ config().title }}</h2>
          @if (config().totalAmount !== undefined) {
            <span 
              class="text-title-medium font-medium"
              [class.text-pulpe-financial-income]="config().totalAmount! > 0"
              [class.text-pulpe-financial-expense]="config().totalAmount! < 0"
              [class.text-on-surface]="config().totalAmount! === 0"
            >
              {{ config().totalAmount! > 0 ? '+' : '' }}{{ config().totalAmount! | currency: 'CHF' : 'symbol' : '1.0-2' : 'fr-CH' }}
            </span>
          }
        </div>
        <p class="text-body-medium text-(--color-on-surface-variant) m-0">
          {{ transactions().length }}
          {{ transactions().length === 1 ? 'transaction' : 'transactions' }}
        </p>
      </div>

      <div class="flex-1 overflow-y-auto">
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
              transaction of transactions();
              track transaction.id;
              let isLast = $last;
              let isOdd = $odd
            ) {
              <mat-list-item 
                [class.odd-item]="isOdd"
                [class.income-item]="transaction.type === 'income'"
                [class.saving-item]="transaction.type === 'saving'"
                [class.expense-item]="transaction.type === 'expense'"
              >
                <div
                  matListItemAvatar
                  class="size-10 bg-surface flex justify-center items-center rounded-full"
                >
                  @switch (transaction.type) {
                    @case ('income') {
                      <mat-icon class="!text-(--pulpe-financial-income)">
                        trending_up
                      </mat-icon>
                    }
                    @case ('saving') {
                      <mat-icon class="!text-(--pulpe-financial-saving)">
                        savings
                      </mat-icon>
                    }
                    @default {
                      <mat-icon class="!text-(--pulpe-financial-expense)">
                        trending_down
                      </mat-icon>
                    }
                  }
                </div>
                <div matListItemTitle>{{ transaction.name }}</div>
                @if (transaction.description) {
                  <div matListItemLine class="text-body-small italic">
                    {{ transaction.description }}
                  </div>
                }
                <div matListItemMeta class="!flex !h-full !items-center">
                  {{ transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '-' : '' }}{{ transaction.amount | currency: 'CHF' : 'symbol' : '1.0-2' : 'fr-CH' }}
                </div>
              </mat-list-item>
              @if (!isLast) {
                <mat-divider></mat-divider>
              }
            }
          </mat-list>
        }
      </div>
    </div>
  `,
  styles: `
    @use '@angular/material' as mat;
    :host {
      color: var(--mat-sys-on-surface);

      @include mat.list-overrides(
        (
          list-item-leading-avatar-color: var(--mat-sys-surface),
          list-item-leading-avatar-size: 41px,
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
              --pulpe-financial-saving
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
}
