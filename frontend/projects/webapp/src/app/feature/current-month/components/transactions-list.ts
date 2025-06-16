import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { Transaction } from '@pulpe/shared';

export interface TransactionsListConfig {
  readonly title: string;
  readonly emptyStateIcon?: string;
  readonly emptyStateTitle?: string;
  readonly emptyStateSubtitle?: string;
}

@Component({
  selector: 'pulpe-transactions-list',
  imports: [CurrencyPipe, MatIconModule, MatDividerModule, MatListModule],
  template: `
    <div
      class="flex flex-col h-full rounded-corner-large overflow-hidden bg-surface-container-low"
    >
      <div class="pb-0 p-4">
        <h2 class="text-headline-small mb-1">{{ config().title }}</h2>
        <p class="text-body-medium text-(--color-on-surface-variant) m-0">
          {{ transactions().length }}
          {{ transactions().length === 1 ? 'transaction' : 'transactions' }}
        </p>
      </div>

      <div class="overflow-y-auto">
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
              {{ config().emptyStateSubtitle || 'Les transactions apparaîtront ici' }}
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
              <mat-list-item [class.odd-item]="isOdd">
                <div
                  matListItemAvatar
                  class="size-10 bg-surface flex justify-center items-center rounded-full"
                >
                  <mat-icon class="!text-(--pulpe-financial-expense)">
                    trending_down
                  </mat-icon>
                </div>
                <div matListItemTitle>{{ transaction.description }}</div>
                @if (transaction.description === 'test') {
                  <div matListItemLine class="text-body-small italic">
                    Transaction fixe mensuelle
                  </div>
                }
                <div matListItemMeta class="!flex !h-full !items-center">
                  -{{
                    transaction.amount
                      | currency: 'CHF' : 'symbol' : '1.0-2' : 'fr-CH'
                  }}
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
    }

    .odd-item {
      @include mat.list-overrides(
        (
          list-item-container-color: var(--mat-sys-surface-container),
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