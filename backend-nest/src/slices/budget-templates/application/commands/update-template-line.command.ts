export class UpdateTemplateLineCommand {
  constructor(
    public readonly templateId: string,
    public readonly lineId: string,
    public readonly userId: string,
    public readonly name?: string,
    public readonly amount?: number,
    public readonly kind?: 'INCOME' | 'FIXED_EXPENSE' | 'VARIABLE_EXPENSE',
    public readonly recurrence?: 'fixed' | 'envelope',
    public readonly description?: string | null,
  ) {}
}
