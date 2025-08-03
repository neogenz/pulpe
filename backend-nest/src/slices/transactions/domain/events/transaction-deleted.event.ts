export class TransactionDeletedEvent {
  constructor(
    public readonly transactionId: string,
    public readonly userId: string,
    public readonly budgetId: string,
    public readonly amount: number,
    public readonly kind: 'expense' | 'income',
  ) {}
}
