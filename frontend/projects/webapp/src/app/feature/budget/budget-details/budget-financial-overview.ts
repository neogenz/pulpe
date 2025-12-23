import {
  Component,
  input,
  computed,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  FinancialSummary,
  type FinancialSummaryData,
} from '@ui/financial-summary/financial-summary';
import { type BudgetLine, type Transaction } from '@pulpe/shared';
import { BudgetCalculator } from '@core/budget/budget-calculator';
import { isRolloverLine } from '@core/rollover/rollover-types';

@Component({
  selector: 'pulpe-budget-financial-overview',
  imports: [FinancialSummary],
  template: `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <pulpe-financial-summary
        [data]="incomeData()"
        data-testid="financial-overview"
      />
      <pulpe-financial-summary [data]="expenseData()" />
      <pulpe-financial-summary [data]="savingsData()" />
      <pulpe-financial-summary [data]="remainingData()" />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetFinancialOverview {
  readonly #budgetCalculator = inject(BudgetCalculator);

  budgetLines = input.required<BudgetLine[]>();
  transactions = input.required<Transaction[]>();

  totals = computed(() => {
    const lines = this.budgetLines();
    const transactions = this.transactions();

    // Calculate base amounts from budget lines
    const income = this.#budgetCalculator.calculatePlannedIncome(lines);
    let expenses = 0;
    let savings = 0;

    lines.forEach((line) => {
      switch (line.kind) {
        case 'expense':
          expenses += line.amount;
          break;
        case 'saving':
          savings += line.amount;
          break;
      }
    });

    // Calculate Living Allowance with transactions impact
    // IMPORTANT: Allocated transactions are already covered by budget line amounts
    // Only count:
    // 1. Free transactions (no budgetLineId)
    // 2. Excess from allocated transactions (if they exceed the budget line amount)
    const initialLivingAllowance = income - expenses - savings;
    const transactionImpact = this.#calculateEffectiveTransactionImpact(
      lines,
      transactions,
    );
    const remaining = initialLivingAllowance + transactionImpact;

    return { income, expenses, savings, remaining };
  });

  /**
   * Calculate the effective transaction impact on the budget.
   * - Free transactions (no budgetLineId): full impact
   * - Allocated transactions: only count excess over budget line amount
   */
  #calculateEffectiveTransactionImpact(
    lines: BudgetLine[],
    transactions: Transaction[],
  ): number {
    // Filter out rollover lines (virtual lines that can't have allocated transactions)
    const realBudgetLines = lines.filter((line) => !isRolloverLine(line));

    // Get IDs of real budget lines for filtering
    const budgetLineIds = new Set(realBudgetLines.map((line) => line.id));

    // 1. Free transactions: those without budgetLineId OR allocated to non-existent lines
    const freeTransactions = transactions.filter(
      (tx) => !tx.budgetLineId || !budgetLineIds.has(tx.budgetLineId),
    );
    let impact =
      this.#budgetCalculator.calculateActualTransactionsAmount(
        freeTransactions,
      );

    // 2. For each real budget line, check if allocated transactions exceed the envelope
    realBudgetLines.forEach((line) => {
      const allocatedTransactions = transactions.filter(
        (tx) => tx.budgetLineId === line.id,
      );
      if (allocatedTransactions.length > 0) {
        const allocatedTotal = allocatedTransactions.reduce(
          (sum, tx) => sum + tx.amount,
          0,
        );
        const excess = allocatedTotal - line.amount;
        if (excess > 0) {
          // Only the excess impacts the budget (as additional expense/saving)
          // The sign depends on the budget line kind
          if (line.kind === 'expense' || line.kind === 'saving') {
            impact -= excess; // Additional expense reduces remaining
          } else if (line.kind === 'income') {
            impact += excess; // Additional income increases remaining
          }
        }
      }
    });

    return impact;
  }

  incomeData = computed<FinancialSummaryData>(() => ({
    title: 'Revenus',
    amount: this.totals().income,
    icon: 'arrow_upward',
    type: 'income',
  }));

  expenseData = computed<FinancialSummaryData>(() => ({
    title: 'Dépenses',
    amount: this.totals().expenses,
    icon: 'arrow_downward',
    type: 'expense',
  }));

  savingsData = computed<FinancialSummaryData>(() => ({
    title: 'Épargne prévue',
    amount: this.totals().savings,
    icon: 'savings',
    type: 'savings',
  }));

  remainingData = computed<FinancialSummaryData>(() => {
    const remaining = this.totals().remaining;
    return {
      title: remaining >= 0 ? 'Disponible à dépenser' : 'Déficit',
      amount: Math.abs(remaining),
      icon: remaining >= 0 ? 'account_balance_wallet' : 'warning',
      type: remaining >= 0 ? 'savings' : 'negative',
    };
  });
}
