export class CreateBudgetCommand {
  constructor(
    public readonly userId: string,
    public readonly month: number,
    public readonly year: number,
    public readonly description: string,
    public readonly templateId: string,
  ) {}
}
