export class GetBudgetQuery {
  constructor(
    public readonly budgetId: string,
    public readonly userId: string,
  ) {}
}
