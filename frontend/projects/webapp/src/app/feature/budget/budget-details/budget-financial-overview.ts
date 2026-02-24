import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { type BudgetLine, type Transaction } from 'pulpe-shared';
import { BudgetCalculator, calculateAllConsumptions } from '@core/budget';
import { RealizedBalanceProgressBar } from '@ui/realized-balance-progress-bar/realized-balance-progress-bar';
import { RealizedBalanceTooltip } from '@ui/realized-balance-tooltip/realized-balance-tooltip';

const COMFORT_THRESHOLD = 0.2;

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
        [class.bg-primary-container]="isPositive()"
        [class.bg-error-container]="!isPositive()"
      >
        <p
          class="text-body-large mb-3"
          [class.text-on-primary-container]="isPositive()"
          [class.text-on-error-container]="!isPositive()"
        >
          @if (isPositive()) {
            Ce qu'il te reste ce mois
          } @else {
            Déficit ce mois
          }
        </p>
        <div
          class="text-display-medium sm:text-display-large font-bold tracking-tight ph-no-capture"
          [class.text-on-primary-container]="isPositive()"
          [class.text-on-error-container]="!isPositive()"
        >
          {{ remainingAbsolute() | number: '1.0-0' : 'de-CH' }}
          <span class="text-headline-small font-normal">CHF</span>
        </div>
        <p
          class="text-body-medium mt-3"
          [class.text-on-primary-container]="isPositive()"
          [class.text-on-error-container]="!isPositive()"
        >
          @if (isPositive()) {
            @if (isComfortable()) {
              Belle marge ce mois
            } @else if (totals().remaining > 0) {
              Tu gères bien
            } @else {
              Pile à l'équilibre
            }
          } @else {
            Ce mois sera serré — mais tu le sais
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
          class="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full bg-[var(--pulpe-financial-income-light)]"
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
          class="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full bg-[var(--pulpe-financial-expense-light)]"
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
          class="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full bg-[var(--pulpe-financial-savings-light)]"
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
  readonly #budgetCalculator = inject(BudgetCalculator);

  readonly budgetLines = input.required<BudgetLine[]>();
  readonly transactions = input.required<Transaction[]>();
  readonly realizedBalance = input.required<number>();
  readonly realizedExpenses = input.required<number>();
  readonly checkedCount = input.required<number>();
  readonly totalCount = input.required<number>();

  readonly totals = computed(() => {
    const lines = this.budgetLines();
    const transactions = this.transactions();

    const consumptionMap = calculateAllConsumptions(lines, transactions);

    const income = this.#budgetCalculator.calculatePlannedIncome(lines);
    let expenses = 0;
    let savings = 0;

    lines.forEach((line) => {
      const consumption = consumptionMap.get(line.id);
      const effectiveAmount = consumption
        ? Math.max(line.amount, consumption.consumed)
        : line.amount;

      switch (line.kind) {
        case 'expense':
          expenses += effectiveAmount;
          break;
        case 'saving':
          savings += effectiveAmount;
          break;
      }
    });

    const freeTransactions = transactions.filter((tx) => !tx.budgetLineId);
    const initialLivingAllowance = income - expenses - savings;
    const transactionImpact =
      this.#budgetCalculator.calculateActualTransactionsAmount(
        freeTransactions,
      );
    const remaining = initialLivingAllowance + transactionImpact;

    return { income, expenses, savings, remaining };
  });

  readonly isPositive = computed(() => this.totals().remaining >= 0);

  readonly isComfortable = computed(
    () => this.totals().remaining > this.totals().income * COMFORT_THRESHOLD,
  );

  readonly remainingAbsolute = computed(() =>
    Math.abs(this.totals().remaining),
  );
}
