import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { Transaction } from '@pulpe/shared';

@Component({
  selector: 'pulpe-fixed-transactions-list',
  imports: [CurrencyPipe, MatIconModule, MatDividerModule],
  template: `
    <div class="fixed-transactions-block overflow-y-auto">
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
          <div class="transactions-list">
            @for (
              transaction of test();
              track transaction.id;
              let isLast = $last;
              let isOdd = $odd
            ) {
              <div
                class="flex items-center gap-2 p-5 justify-between"
                [class.bg-(--mat-sys-surface-container)]="isOdd"
              >
                <div class="flex items-center gap-1.5">
                  <div
                    class="size-10 bg-surface flex justify-center items-center rounded-full"
                  >
                    <mat-icon class="!text-(--pulpe-financial-expense)">
                      trending_down
                    </mat-icon>
                  </div>

                  <div class="transaction-content">
                    <div class="text-title-medium">
                      {{ transaction.description }}
                    </div>
                    <div class="text-body-small italic">
                      Transaction fixe mensuelle
                    </div>
                  </div>
                </div>

                <div class="text-title-medium text-(--pulpe-financial-expense)">
                  {{
                    transaction.amount
                      | currency: 'CHF' : 'symbol' : '1.0-2' : 'fr-CH'
                  }}
                </div>
              </div>

              @if (!isLast) {
                <mat-divider class="mx-0"></mat-divider>
              }
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;

      background-color: var(--mat-sys-surface-container-low);
      border-radius: var(--mat-sys-corner-large);

      color: var(--mat-sys-on-surface);
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
