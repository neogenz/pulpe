export class UpdateBudgetCommand {
  constructor(
    public readonly budgetId: string,
    public readonly userId: string,
    public readonly description?: string,
    public readonly month?: number,
    public readonly year?: number,
  ) {}
}
