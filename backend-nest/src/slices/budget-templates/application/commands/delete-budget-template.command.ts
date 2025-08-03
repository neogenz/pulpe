export class DeleteBudgetTemplateCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
  ) {}
}
