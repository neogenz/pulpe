import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

export interface FinancialSummaryData {
  readonly title: string;
  readonly amount: number | string;
  readonly icon: string;
  readonly type: 'income' | 'expense' | 'savings' | 'negative';
  readonly isClickable?: boolean;
}

@Component({
  selector: 'pulpe-financial-summary',
  imports: [MatCardModule, MatIconModule, CurrencyPipe],
  template: `
    <mat-card
      appearance="outlined"
      class="rounded-3xl expressive-card"
      [attr.data-type]="data().type"
    >
      <mat-card-content class="p-4">
        <div class="flex items-center space-x-3">
          <div
            class="w-12 h-12 rounded-full flex items-center justify-center icon-container shrink-0"
            [attr.data-type]="data().type"
          >
            <mat-icon class="text-white! text-xl">
              {{ data().icon }}
            </mat-icon>
          </div>
          <div class="flex-1 min-w-0">
            <h3
              class="mb-1 financial-title ph-no-capture inline-flex items-center gap-1"
            >
              {{ data().title }}
              <ng-content select="[slot=title-info]" />
            </h3>
            <p
              class="text-headline-small financial-amount ph-no-capture overflow-hidden text-ellipsis"
            >
              {{
                data().amount | currency: 'CHF' : 'symbol' : '1.2-2' : 'de-CH'
              }}
            </p>
          </div>
        </div>

        <ng-content></ng-content>
      </mat-card-content>
    </mat-card>
  `,
  styles: [
    `
      /* MD3 Expressive Card - Dynamic elevation on hover */
      .expressive-card {
        transition:
          transform var(--expressive-spatial-default-duration, 500ms)
            var(
              --expressive-spatial-default-easing,
              cubic-bezier(0.38, 1.21, 0.22, 1)
            ),
          box-shadow var(--expressive-effect-default-duration, 200ms)
            var(
              --expressive-effect-default-easing,
              cubic-bezier(0.34, 0.8, 0.34, 1)
            );

        &:hover {
          transform: translateY(-4px);
          box-shadow: var(
            --elevation-level3,
            0 4px 6px -1px rgba(0, 0, 0, 0.1)
          );
        }
      }

      .icon-container {
        /* Expressive scale on card hover */
        transition: transform var(--expressive-spatial-fast-duration, 350ms)
          var(
            --expressive-spatial-fast-easing,
            cubic-bezier(0.42, 1.85, 0.21, 0.9)
          );

        .expressive-card:hover & {
          transform: scale(1.1);
        }
      }

      .icon-container[data-type='income'] {
        background-color: var(--pulpe-financial-income);
      }

      .icon-container[data-type='expense'] {
        background-color: var(--pulpe-financial-expense);
      }

      .icon-container[data-type='savings'] {
        background-color: var(--pulpe-financial-savings);
      }

      .icon-container[data-type='negative'] {
        background-color: var(--pulpe-financial-negative);
      }

      mat-card[data-type='income'] .financial-title,
      mat-card[data-type='income'] .financial-amount {
        color: var(--pulpe-financial-income);
      }

      mat-card[data-type='expense'] .financial-title,
      mat-card[data-type='expense'] .financial-amount {
        color: var(--pulpe-financial-expense);
      }

      mat-card[data-type='savings'] .financial-title,
      mat-card[data-type='savings'] .financial-amount {
        color: var(--pulpe-financial-savings);
      }

      mat-card[data-type='negative'] .financial-title,
      mat-card[data-type='negative'] .financial-amount {
        color: var(--pulpe-financial-negative);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinancialSummary {
  data = input.required<FinancialSummaryData>();
}
