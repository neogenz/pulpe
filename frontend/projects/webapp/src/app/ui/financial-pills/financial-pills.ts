import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { CURRENCY_METADATA, type SupportedCurrency } from 'pulpe-shared';

export interface FinancialPillsTotals {
  income: number;
  expenses: number;
  savings: number;
}

type PillKey = keyof FinancialPillsTotals;

interface PillConfig {
  readonly key: PillKey;
  readonly testId: string;
  readonly icon: string;
  readonly bgClass: string;
  readonly colorClass: string;
  readonly labelKey: string;
}

@Component({
  selector: 'pulpe-financial-pills',
  imports: [MatIconModule, DecimalPipe, TranslocoPipe],
  template: `
    <div class="pills-scroll-fade -mx-4 md:mx-0">
      <div
        role="list"
        [attr.aria-label]="'common.financialPills.ariaLabel' | transloco"
        class="flex gap-3 overflow-x-auto px-4 md:px-0 md:justify-center snap-x snap-mandatory pb-2 scrollbar-hide"
      >
        @for (pill of pills; track pill.key) {
          <div
            role="listitem"
            [attr.data-testid]="pill.testId"
            [class]="
              'snap-start flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full ' +
              pill.bgClass
            "
          >
            <mat-icon [class]="pill.colorClass + ' mat-icon-sm'">{{
              pill.icon
            }}</mat-icon>
            <div class="flex flex-col">
              <span
                class="text-label-small leading-tight text-on-financial-light"
                >{{ pill.labelKey | transloco }}</span
              >
              <span
                [class]="
                  'text-label-large font-semibold ph-no-capture ' +
                  pill.colorClass
                "
              >
                {{ totals()[pill.key] | number: '1.0-0' : locale() }}
                <span class="text-label-small">{{ currencySymbol() }}</span>
              </span>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .pills-scroll-fade {
      position: relative;

      &::before,
      &::after {
        content: '';
        position: absolute;
        top: 0;
        bottom: 0;
        width: 24px;
        pointer-events: none;
        z-index: 1;
      }

      &::before {
        left: 0;
        background: linear-gradient(
          to right,
          var(--mat-sys-surface),
          transparent
        );
      }

      &::after {
        right: 0;
        background: linear-gradient(
          to left,
          var(--mat-sys-surface),
          transparent
        );
      }

      @media (min-width: 768px) {
        &::before,
        &::after {
          display: none;
        }
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinancialPills {
  readonly totals = input.required<FinancialPillsTotals>();
  readonly currency = input<SupportedCurrency>('CHF');
  readonly locale = input<string>('de-CH');

  protected readonly currencySymbol = computed(
    () => CURRENCY_METADATA[this.currency()].symbol,
  );

  protected readonly pills: readonly PillConfig[] = [
    {
      key: 'income',
      testId: 'income-pill',
      icon: 'trending_up',
      bgClass: 'bg-(--pulpe-financial-income-light)',
      colorClass: 'text-financial-income',
      labelKey: 'common.financialPills.income',
    },
    {
      key: 'expenses',
      testId: 'expense-pill',
      icon: 'trending_down',
      bgClass: 'bg-(--pulpe-financial-expense-light)',
      colorClass: 'text-financial-expense',
      labelKey: 'common.financialPills.expenses',
    },
    {
      key: 'savings',
      testId: 'savings-pill',
      icon: 'savings',
      bgClass: 'bg-(--pulpe-financial-savings-light)',
      colorClass: 'text-financial-savings',
      labelKey: 'common.financialPills.savings',
    },
  ];
}
