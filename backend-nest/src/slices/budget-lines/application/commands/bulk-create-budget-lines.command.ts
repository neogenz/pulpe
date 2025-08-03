export interface BudgetLineData {
  name: string;
  amount: number;
  kind: 'fixed' | 'envelope' | 'goal';
  recurrence: 'monthly' | 'yearly' | 'one-time';
  templateLineId?: string | null;
  savingsGoalId?: string | null;
  isManuallyAdjusted?: boolean;
}

export class BulkCreateBudgetLinesCommand {
  constructor(
    public readonly userId: string,
    public readonly budgetId: string,
    public readonly budgetLines: BudgetLineData[],
  ) {}
}
