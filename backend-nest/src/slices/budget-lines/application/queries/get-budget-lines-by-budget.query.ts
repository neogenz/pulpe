export class GetBudgetLinesByBudgetQuery {
  constructor(
    public readonly budgetId: string,
    public readonly userId: string,
  ) {}
}
