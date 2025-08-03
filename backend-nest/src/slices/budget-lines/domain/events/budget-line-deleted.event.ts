export class BudgetLineDeletedEvent {
  constructor(
    public readonly budgetLineId: string,
    public readonly budgetId: string,
    public readonly deletedAt: Date,
  ) {}
}
