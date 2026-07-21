import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { CURRENCY_METADATA, type SupportedCurrency } from 'pulpe-shared';
import { FinancialPills } from '../financial-pills/financial-pills';

export interface FinancialTotals {
  income: number;
  expenses: number;
  savings: number;
  remaining: number;
}

@Component({
  selector: 'pulpe-budget-financial-overview',
  imports: [DecimalPipe, FinancialPills, TranslocoPipe],
  template: `
    <div class="space-y-6">
      <div
        class="text-center py-8 px-6 rounded-3xl"
        [class.bg-primary-container]="budgetState() === 'comfortable'"
        [class.hero-warning]="budgetState() === 'warning'"
        [class.bg-error-container]="budgetState() === 'deficit'"
      >
        <p
          class="text-body-large mb-3"
          [class.text-on-primary-container]="budgetState() === 'comfortable'"
          [class.text-warning-on-container]="budgetState() === 'warning'"
          [class.text-on-error-container]="budgetState() === 'deficit'"
        >
          @switch (budgetState()) {
            @case ('comfortable') {
              {{ 'budget.overview.remainingThisMonth' | transloco }}
              <span
                class="text-body-small text-on-primary-container/90 block mt-0.5"
                >{{ 'budget.overview.perForecast' | transloco }}</span
              >
            }
            @case ('warning') {
              {{ 'budget.overview.remainingThisMonth' | transloco }}
              <span
                class="text-body-small text-warning-on-container/90 block mt-0.5"
                >{{ 'budget.overview.perForecast' | transloco }}</span
              >
            }
            @case ('deficit') {
              {{ 'budget.overview.deficitThisMonth' | transloco }}
              <span
                class="text-body-small text-on-error-container/90 block mt-0.5"
                >{{ 'budget.overview.perForecast' | transloco }}</span
              >
            }
          }
        </p>
        <div
          class="text-display-medium sm:text-display-large font-bold tracking-tight ph-no-capture"
          [class.text-on-primary-container]="budgetState() === 'comfortable'"
          [class.text-warning]="budgetState() === 'warning'"
          [class.text-on-error-container]="budgetState() === 'deficit'"
        >
          {{ remainingAbsolute() | number: '1.0-0' : locale() }}
          <span class="text-headline-small font-normal">{{
            currencySymbol()
          }}</span>
        </div>
        @if (hasRollover()) {
          <p
            class="text-body-small mt-1.5"
            [class.text-on-primary-container]="budgetState() === 'comfortable'"
            [class.text-warning-on-container]="budgetState() === 'warning'"
            [class.text-on-error-container]="budgetState() === 'deficit'"
            role="status"
            [attr.aria-label]="rolloverAriaLabel()"
            data-testid="financial-overview-rollover"
          >
            {{ 'budget.overview.rolloverIncluded' | transloco }}
            <span class="font-medium ph-no-capture">
              {{ isRolloverPositive() ? '+' : '−'
              }}{{ rolloverAbsolute() | number: '1.0-0' : locale() }}
              {{ currencySymbol() }}
            </span>
          </p>
        }
        <p
          class="text-body-medium mt-3"
          [class.text-on-primary-container]="budgetState() === 'comfortable'"
          [class.text-warning-on-container]="budgetState() === 'warning'"
          [class.text-on-error-container]="budgetState() === 'deficit'"
        >
          @switch (budgetState()) {
            @case ('comfortable') {
              {{ 'budget.overview.niceMargin' | transloco }}
            }
            @case ('warning') {
              @if (totals().remaining > 0) {
                {{ 'budget.overview.youManageWell' | transloco }}
              } @else {
                {{ 'budget.overview.justBalanced' | transloco }}
              }
            }
            @case ('deficit') {
              {{ 'budget.overview.tightMonth' | transloco }}
            }
          }
        </p>
      </div>

      <pulpe-financial-pills
        [totals]="{
          income: totals().income,
          expenses: totals().expenses,
          savings: totals().savings,
        }"
        [currency]="currency()"
        [locale]="locale()"
      />
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .hero-warning {
      background-color: var(--pulpe-amber-container);
    }

    .text-warning {
      color: var(--pulpe-amber);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetFinancialOverview {
  readonly #transloco = inject(TranslocoService);

  readonly totals = input.required<FinancialTotals>();
  readonly currency = input<SupportedCurrency>('CHF');
  readonly locale = input<string>('de-CH');
  readonly warningThreshold = input(90);
  readonly rollover = input(0);

  protected readonly currencySymbol = computed(
    () => CURRENCY_METADATA[this.currency()].symbol,
  );

  readonly isPositive = computed(() => this.totals().remaining >= 0);

  readonly isComfortable = computed(() => {
    const { remaining, income } = this.totals();
    if (income <= 0) return remaining >= 0;
    const consumedPercent = ((income - remaining) / income) * 100;
    return consumedPercent <= this.warningThreshold();
  });

  readonly budgetState = computed<'comfortable' | 'warning' | 'deficit'>(() => {
    if (!this.isPositive()) return 'deficit';
    if (!this.isComfortable()) return 'warning';
    return 'comfortable';
  });

  readonly remainingAbsolute = computed(() =>
    Math.abs(this.totals().remaining),
  );

  // Gate on the rounded value, not `!== 0`: a sub-unit residual rollover would
  // otherwise render "+0 €" — a disclosure claiming an amount it then shows as zero.
  protected readonly hasRollover = computed(
    () => Math.round(this.rollover()) !== 0,
  );

  protected readonly isRolloverPositive = computed(() => this.rollover() > 0);

  protected readonly rolloverAbsolute = computed(() =>
    Math.abs(this.rollover()),
  );

  protected readonly rolloverAriaLabel = computed(() =>
    this.#transloco.translate(
      this.isRolloverPositive()
        ? 'budget.overview.rolloverIncludedSurplusAria'
        : 'budget.overview.rolloverIncludedDeficitAria',
      {
        amount: this.rolloverAbsolute().toLocaleString(this.locale()),
        currency: this.currency(),
      },
    ),
  );
}
