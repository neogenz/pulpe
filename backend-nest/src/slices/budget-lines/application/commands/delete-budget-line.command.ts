export class DeleteBudgetLineCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
  ) {}
}
