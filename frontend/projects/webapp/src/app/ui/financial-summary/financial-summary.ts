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
      class="rounded-2xl"
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
              class="text-headline-small financial-amount ph-no-capture overflow-hidden text-ellipsis font-mono"
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
