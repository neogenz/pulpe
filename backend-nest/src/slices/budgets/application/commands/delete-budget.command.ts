export class DeleteBudgetCommand {
  constructor(
    public readonly budgetId: string,
    public readonly userId: string,
  ) {}
}
