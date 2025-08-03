export class TransactionCreatedEvent {
  constructor(
    public readonly transactionId: string,
    public readonly userId: string,
    public readonly budgetId: string,
    public readonly amount: number,
    public readonly kind: 'expense' | 'income',
    public readonly category: string | null,
  ) {}
}
