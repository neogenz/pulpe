export class CreateTransactionCommand {
  constructor(
    public readonly userId: string,
    public readonly budgetId: string,
    public readonly amount: number,
    public readonly name: string,
    public readonly kind: 'expense' | 'income',
    public readonly transactionDate: string,
    public readonly isOutOfBudget: boolean,
    public readonly category: string | null,
  ) {}
}
