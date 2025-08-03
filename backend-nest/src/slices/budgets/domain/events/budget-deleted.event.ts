export class BudgetDeletedEvent {
  constructor(
    public readonly budgetId: string,
    public readonly userId: string,
    public readonly month: number,
    public readonly year: number,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
