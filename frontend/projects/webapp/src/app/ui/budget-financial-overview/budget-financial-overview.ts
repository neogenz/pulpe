import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RealizedBalanceProgressBar } from '@ui/realized-balance-progress-bar/realized-balance-progress-bar';
import { RealizedBalanceTooltip } from '@ui/realized-balance-tooltip/realized-balance-tooltip';

export interface FinancialTotals {
  income: number;
  expenses: number;
  savings: number;
  remaining: number;
}

/**
 * BudgetFinancialOverview - "Financial Pulse" design
 *
 * Hero metric (Disponible) prominently displayed with supporting metrics as pills.
 * Follows M3 Expressive principle: important elements appear larger.
 */
@Component({
  selector: 'pulpe-budget-financial-overview',
  imports: [
    MatIconModule,
    DecimalPipe,
    RealizedBalanceProgressBar,
    RealizedBalanceTooltip,
  ],
  template: `
    <div class="space-y-6">
      <!-- Hero Section: What matters most -->
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
              Ce qu'il te reste ce mois
            }
            @case ('warning') {
              Ce qu'il te reste ce mois
            }
            @case ('deficit') {
              Déficit ce mois
            }
          }
        </p>
        <div
          class="text-display-medium sm:text-display-large font-bold tracking-tight ph-no-capture"
          [class.text-on-primary-container]="budgetState() === 'comfortable'"
          [class.text-warning]="budgetState() === 'warning'"
          [class.text-on-error-container]="budgetState() === 'deficit'"
        >
          {{ remainingAbsolute() | number: '1.0-0' : 'de-CH' }}
          <span class="text-headline-small font-normal">CHF</span>
        </div>
        <p
          class="text-body-medium mt-3"
          [class.text-on-primary-container]="budgetState() === 'comfortable'"
          [class.text-warning-on-container]="budgetState() === 'warning'"
          [class.text-on-error-container]="budgetState() === 'deficit'"
        >
          @switch (budgetState()) {
            @case ('comfortable') {
              Belle marge ce mois
            }
            @case ('warning') {
              @if (totals().remaining > 0) {
                Tu gères bien
              } @else {
                Pile à l'équilibre
              }
            }
            @case ('deficit') {
              Ce mois sera serré — mais tu le sais
            }
          }
        </p>
      </div>

      <!-- Supporting Metrics: Pill-style, horizontal scroll on mobile -->
      <div
        role="list"
        aria-label="Résumé financier"
        class="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:justify-center scrollbar-hide"
      >
        <!-- Income Pill -->
        <div
          role="listitem"
          class="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full bg-(--pulpe-financial-income-light)"
        >
          <mat-icon class="text-financial-income mat-icon-sm"
            >trending_up</mat-icon
          >
          <div class="flex flex-col">
            <span class="text-label-small leading-tight text-on-financial-light"
              >Revenus</span
            >
            <span
              class="text-label-large font-semibold text-financial-income ph-no-capture"
            >
              {{ totals().income | number: '1.0-0' : 'de-CH' }} CHF
            </span>
          </div>
        </div>

        <!-- Expenses Pill -->
        <div
          role="listitem"
          class="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full bg-(--pulpe-financial-expense-light)"
        >
          <mat-icon class="text-financial-expense mat-icon-sm"
            >trending_down</mat-icon
          >
          <div class="flex flex-col">
            <span class="text-label-small leading-tight text-on-financial-light"
              >Dépenses</span
            >
            <span
              class="text-label-large font-semibold text-financial-expense ph-no-capture"
            >
              {{ totals().expenses | number: '1.0-0' : 'de-CH' }} CHF
            </span>
          </div>
        </div>

        <!-- Savings Pill -->
        <div
          role="listitem"
          class="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full bg-(--pulpe-financial-savings-light)"
        >
          <mat-icon class="text-financial-savings mat-icon-sm"
            >savings</mat-icon
          >
          <div class="flex flex-col">
            <span class="text-label-small leading-tight text-on-financial-light"
              >Épargne</span
            >
            <span
              class="text-label-large font-semibold text-financial-savings ph-no-capture"
            >
              {{ totals().savings | number: '1.0-0' : 'de-CH' }} CHF
            </span>
          </div>
        </div>
      </div>

      <!-- Journey Tracker: Realized balance progress -->
      <pulpe-realized-balance-progress-bar
        [realizedExpenses]="realizedExpenses()"
        [realizedBalance]="realizedBalance()"
        [checkedCount]="checkedCount()"
        [totalCount]="totalCount()"
        data-testid="realized-balance-progress"
      >
        <pulpe-realized-balance-tooltip slot="title-info" />
      </pulpe-realized-balance-progress-bar>
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

    .text-warning-on-container {
      color: var(--pulpe-amber-on-container);
    }

    /* Hide scrollbar but keep functionality */
    .scrollbar-hide {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
    .scrollbar-hide::-webkit-scrollbar {
      display: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetFinancialOverview {
  readonly totals = input.required<FinancialTotals>();
  readonly realizedBalance = input.required<number>();
  readonly realizedExpenses = input.required<number>();
  readonly checkedCount = input.required<number>();
  readonly totalCount = input.required<number>();
  readonly warningThreshold = input(90);

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
}
