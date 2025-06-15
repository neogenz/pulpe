import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { Transaction } from '@pulpe/shared';

@Component({
  selector: 'pulpe-fixed-transactions-list',
  imports: [CurrencyPipe, MatIconModule, MatDividerModule, MatListModule],
  template: `
    <div class="fixed-transactions-block">
      <div class="pb-0 p-4">
        <h2 class="text-headline-small mb-1">Dépenses fixes</h2>
        <p class="text-body-medium text-(--color-on-surface-variant) m-0">
          {{ transactions().length }}
          {{ transactions().length === 1 ? 'transaction' : 'transactions' }}
        </p>
      </div>

      <div class="content">
        @if (transactions().length === 0) {
          <div
            class="flex flex-col items-center justify-center py-8 text-center"
          >
            <mat-icon
              class="text-(--color-outline) mb-3"
              style="font-size: 48px; width: 48px; height: 48px;"
            >
              trending_down
            </mat-icon>
            <p class="text-body-large text-(--color-on-surface-variant) mb-1">
              Aucune dépense fixe
            </p>
            <p class="text-body-small text-(--color-outline)">
              Vos dépenses fixes apparaîtront ici
            </p>
          </div>
        } @else {
          <mat-list>
            @for (
              transaction of transactions();
              track transaction.id;
              let isLast = $last;
              let isOdd = $odd
            ) {
              <mat-list-item [class.!bg-surface-container]="isOdd">
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
      display: block;
      width: 100%;
      background-color: var(--mat-sys-surface-container-low);
      border-radius: var(--mat-sys-corner-large);
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
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FixedTransactionsList {
  transactions = input.required<Transaction[]>();

  test = computed(() => [
    ...this.transactions(),
    ...this.transactions(),
    ...this.transactions(),
    ...this.transactions(),
    ...this.transactions(),
    ...this.transactions(),
  ]);
}
