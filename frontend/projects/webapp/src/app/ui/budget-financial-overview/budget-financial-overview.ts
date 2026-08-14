import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
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
  imports: [
    DecimalPipe,
    FinancialPills,
    MatButtonModule,
    MatIconModule,
    TranslocoPipe,
  ],
  template: `
    <div class="space-y-5">
      <section
        class="overview-hero rounded-3xl px-6 py-7 text-center sm:py-8"
        [class.bg-primary-container]="budgetState() === 'comfortable'"
        [class.hero-warning]="budgetState() === 'warning'"
        [class.bg-error-container]="budgetState() === 'deficit'"
        [class.text-on-primary-container]="budgetState() === 'comfortable'"
        [class.text-warning-on-container]="budgetState() === 'warning'"
        [class.text-on-error-container]="budgetState() === 'deficit'"
      >
        <p class="text-body-large font-medium">
          {{ overviewTitleKey() | transloco }}
        </p>

        <div
          class="mt-2 text-display-medium font-bold tracking-tight tabular-nums ph-no-capture sm:text-display-large"
        >
          {{ remainingAbsolute() | number: '1.0-0' : locale() }}
          <span class="text-headline-small font-normal">{{
            currencySymbol()
          }}</span>
        </div>

        @if (hasRollover()) {
          <p
            class="mt-1.5 text-body-small"
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

        @if (budgetState() === 'deficit' && showSavingsAction()) {
          <div class="overview-resolution">
            <p class="mx-auto max-w-[42rem] text-body-medium">
              {{ 'budget.savingsWithdrawal.overviewHelp' | transloco }}
            </p>
            <button
              matButton="tonal"
              class="overview-recovery-button mt-4"
              (click)="coverWithSavings.emit()"
              data-testid="financial-overview-cover-with-savings"
            >
              <mat-icon>savings</mat-icon>
              {{ 'budget.savingsWithdrawal.overviewCta' | transloco }}
            </button>
          </div>
        }
      </section>

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
      background-color: color-mix(
        in srgb,
        var(--pulpe-amber-container) 55%,
        var(--mat-sys-surface)
      );
    }

    .overview-resolution {
      margin-top: 1.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid color-mix(in srgb, currentColor 18%, transparent);
    }

    .overview-recovery-button {
      --mat-button-tonal-container-color: var(--mat-sys-surface);
      --mat-button-tonal-label-text-color: var(--mat-sys-error);
      --mat-button-tonal-state-layer-color: var(--mat-sys-error);
      --mat-button-tonal-ripple-color: color-mix(
        in srgb,
        var(--mat-sys-error) 16%,
        transparent
      );
      border: 1px solid
        color-mix(in srgb, var(--mat-sys-error) 24%, transparent);
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
  readonly showSavingsAction = input(false);
  readonly coverWithSavings = output<void>();

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

  protected readonly overviewTitleKey = computed(() =>
    this.budgetState() === 'deficit'
      ? 'budget.overview.deficitThisMonth'
      : 'budget.overview.remainingThisMonth',
  );

  readonly remainingAbsolute = computed(() =>
    Math.abs(this.totals().remaining),
  );

  // `rollover` is only non-zero when a previous budget exists — the backend derives
  // it as the sum of prior ending balances — so gating on the amount alone is enough;
  // no separate `previousBudgetId` check is needed.
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
        // Round to match the visible figure (rendered at '1.0-0'), so VoiceOver
        // never announces a different amount than the one on screen.
        amount: Math.round(this.rolloverAbsolute()).toLocaleString(
          this.locale(),
        ),
        currency: this.currency(),
      },
    ),
  );
}
