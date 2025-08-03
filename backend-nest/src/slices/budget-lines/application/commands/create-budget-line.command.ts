export class CreateBudgetLineCommand {
  constructor(
    public readonly userId: string,
    public readonly budgetId: string,
    public readonly name: string,
    public readonly amount: number,
    public readonly kind: 'fixed' | 'envelope' | 'goal',
    public readonly recurrence: 'monthly' | 'yearly' | 'one-time',
    public readonly templateLineId?: string | null,
    public readonly savingsGoalId?: string | null,
    public readonly isManuallyAdjusted?: boolean,
  ) {}
}
