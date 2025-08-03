export class BudgetUpdatedEvent {
  constructor(
    public readonly budgetId: string,
    public readonly userId: string,
    public readonly changes: {
      description?: string;
      month?: number;
      year?: number;
    },
    public readonly occurredAt: Date = new Date(),
  ) {}
}
