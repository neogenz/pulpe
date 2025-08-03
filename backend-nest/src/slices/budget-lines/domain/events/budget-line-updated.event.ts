export class BudgetLineUpdatedEvent {
  constructor(
    public readonly budgetLineId: string,
    public readonly budgetId: string,
    public readonly changes: {
      name?: string;
      amount?: number;
      kind?: string;
      recurrence?: string;
      isManuallyAdjusted?: boolean;
    },
    public readonly updatedAt: Date,
  ) {}
}
