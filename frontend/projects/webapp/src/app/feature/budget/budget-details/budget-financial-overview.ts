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
import { calculateAllConsumptions } from '@core/budget/budget-line-consumption';

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

    // Calculer les consommations de chaque enveloppe pour les dépassements
    const consumptionMap = calculateAllConsumptions(lines, transactions);

    // Calculate base amounts from budget lines
    // Pour les dépenses et épargnes, utiliser MAX(prévu, consommé) pour les dépassements
    const income = this.#budgetCalculator.calculatePlannedIncome(lines);
    let expenses = 0;
    let savings = 0;

    lines.forEach((line) => {
      const consumption = consumptionMap.get(line.id);
      // Utiliser MAX(prévu, consommé) pour prendre en compte les dépassements
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

    // Calculate Living Allowance with transactions impact
    // Note: Les transactions allouées sont déjà prises en compte via MAX(prévu, consommé)
    // Seules les transactions LIBRES (non allouées) impactent le budget ici
    const freeTransactions = transactions.filter((tx) => !tx.budgetLineId);
    const initialLivingAllowance = income - expenses - savings;
    const transactionImpact =
      this.#budgetCalculator.calculateActualTransactionsAmount(
        freeTransactions,
      );
    const remaining = initialLivingAllowance + transactionImpact;

    return { income, expenses, savings, remaining };
  });

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
