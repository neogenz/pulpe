export class BudgetCreatedEvent {
  constructor(
    public readonly budgetId: string,
    public readonly userId: string,
    public readonly templateId: string,
    public readonly month: number,
    public readonly year: number,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
