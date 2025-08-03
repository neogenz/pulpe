export class ListBudgetLinesQuery {
  constructor(
    public readonly userId: string,
    public readonly filters?: {
      budgetId?: string;
      templateLineId?: string;
      savingsGoalId?: string;
      kind?: string;
      recurrence?: string;
    },
  ) {}
}
