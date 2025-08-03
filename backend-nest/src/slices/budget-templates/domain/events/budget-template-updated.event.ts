export class BudgetTemplateUpdatedEvent {
  constructor(
    public readonly templateId: string,
    public readonly userId: string,
    public readonly changes: {
      name?: string;
      description?: string | null;
      isDefault?: boolean;
      linesUpdated?: boolean;
    },
    public readonly updatedAt: Date,
  ) {}
}
