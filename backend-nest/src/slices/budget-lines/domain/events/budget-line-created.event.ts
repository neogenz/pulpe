export class BudgetLineCreatedEvent {
  constructor(
    public readonly budgetLineId: string,
    public readonly budgetId: string,
    public readonly name: string,
    public readonly amount: number,
    public readonly kind: string,
    public readonly createdAt: Date,
  ) {}
}
