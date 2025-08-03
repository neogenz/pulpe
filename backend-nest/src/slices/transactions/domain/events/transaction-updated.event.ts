export class TransactionUpdatedEvent {
  constructor(
    public readonly transactionId: string,
    public readonly userId: string,
    public readonly budgetId: string,
    public readonly changes: {
      amount?: number;
      name?: string;
      kind?: 'expense' | 'income';
      category?: string | null;
      isOutOfBudget?: boolean;
    },
  ) {}
}
