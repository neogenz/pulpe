import { Injectable } from '@angular/core';
import { BudgetLine, Transaction } from '@pulpe/shared';

@Injectable()
export class BudgetLineMapper {
  toTransaction(budgetLine: BudgetLine, budgetId: string): Transaction {
    return {
      id: budgetLine.id,
      budgetId: budgetId,
      name: budgetLine.name,
      amount: budgetLine.amount,
      kind: budgetLine.kind,
      transactionDate: new Date().toISOString(),
      isOutOfBudget: false,
      category: null,
      createdAt: budgetLine.createdAt,
      updatedAt: budgetLine.updatedAt,
    };
  }

  toTransactions(budgetLines: BudgetLine[], budgetId: string): Transaction[] {
    return budgetLines.map((line) => this.toTransaction(line, budgetId));
  }
}
