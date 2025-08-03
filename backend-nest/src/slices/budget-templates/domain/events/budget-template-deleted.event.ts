export class BudgetTemplateDeletedEvent {
  constructor(
    public readonly templateId: string,
    public readonly userId: string,
    public readonly name: string,
    public readonly wasDefault: boolean,
    public readonly deletedAt: Date,
  ) {}
}
