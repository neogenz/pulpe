export class UpdateBudgetLineCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly name?: string,
    public readonly amount?: number,
    public readonly kind?: 'fixed' | 'envelope' | 'goal',
    public readonly recurrence?: 'monthly' | 'yearly' | 'one-time',
    public readonly savingsGoalId?: string | null,
    public readonly isManuallyAdjusted?: boolean,
  ) {}
}
