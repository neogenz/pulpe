export class BudgetTemplateDuplicatedEvent {
  constructor(
    public readonly originalTemplateId: string,
    public readonly newTemplateId: string,
    public readonly userId: string,
    public readonly newName: string,
    public readonly duplicatedAt: Date,
  ) {}
}
