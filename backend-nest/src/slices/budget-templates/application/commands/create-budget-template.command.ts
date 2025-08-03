export interface CreateTemplateLineData {
  name: string;
  amount: number;
  kind: 'INCOME' | 'FIXED_EXPENSE' | 'VARIABLE_EXPENSE';
  recurrence: 'fixed' | 'envelope';
  description?: string;
}

export class CreateBudgetTemplateCommand {
  constructor(
    public readonly userId: string,
    public readonly name: string,
    public readonly description?: string,
    public readonly isDefault?: boolean,
    public readonly lines?: CreateTemplateLineData[],
  ) {}
}
