export class BudgetTemplateCreatedEvent {
  constructor(
    public readonly templateId: string,
    public readonly userId: string,
    public readonly name: string,
    public readonly isDefault: boolean,
    public readonly linesCount: number,
    public readonly createdAt: Date,
  ) {}
}
